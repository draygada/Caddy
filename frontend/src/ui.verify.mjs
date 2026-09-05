import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import * as THREE from 'three'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const APP_PORT = Number(process.env.FB03_APP_PORT ?? 4175)
const DEBUG_PORT = Number(process.env.FB03_DEBUG_PORT ?? 9351)
const APP_URL = `http://127.0.0.1:${APP_PORT}/`
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`
const SCENARIOS = ['baseline', 'f1', 'f3', 'f8', 'missing']
const EXPECTED_TRIPWIRES = { baseline: 1, f1: 1, f3: 2, f8: 2, missing: 1 }
const VIEWPORTS = [
  { width: 1280, height: 720, mobile: false },
  { width: 1920, height: 1080, mobile: false },
  { width: 390, height: 844, mobile: true },
]

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForHttp(url, label, timeout = 15_000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error
    }
    await delay(50)
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? 'no response'}`)
}

class DevToolsClient {
  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const handlers = this.pending.get(message.id)
      if (!handlers) return
      this.pending.delete(message.id)
      if (message.error) handlers.reject(new Error(`${message.error.message} (${handlers.method})`))
      else handlers.resolve(message.result)
    })
  }

  static async connect(webSocketDebuggerUrl) {
    const socket = new WebSocket(webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    return new DevToolsClient(socket)
  }

  send(method, params = {}) {
    const id = ++this.nextId
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { method, resolve, reject }))
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) {
      const description = response.exceptionDetails.exception?.description ?? response.exceptionDetails.text
      throw new Error(`Browser evaluation failed: ${description}`)
    }
    return response.result.value
  }

  async waitFor(expression, label, timeout = 10_000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await this.evaluate(`Boolean(${expression})`)) return
      await delay(20)
    }
    throw new Error(`Timed out waiting for ${label}`)
  }

  close() {
    this.socket.close()
  }
}

function captureOutput(process, sink) {
  process.stdout.on('data', (chunk) => sink.push(String(chunk)))
  process.stderr.on('data', (chunk) => sink.push(String(chunk)))
}

async function selectScenario(client, scenarioId) {
  await client.evaluate(`document.querySelector('[data-scenario-id="${scenarioId}"]').click()`)
  await client.waitFor(
    `document.querySelector('.evaluation-state.confirmed') && document.querySelector('[data-scenario-id="${scenarioId}"]').getAttribute('aria-pressed') === 'true'`,
    `${scenarioId} confirmation`,
  )
  await delay(40)
}

const layoutExpression = String.raw`(() => {
  const visible = (element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
  }
  const rectFor = (element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
  }
  const selector = innerWidth <= 560 ? '.mobile-location-rail button, .tripwire-marker' : '.slot-marker, .tripwire-marker'
  const elements = [...document.querySelectorAll(selector)].filter(visible).map((element) => ({
    kind: element.classList.contains('tripwire-marker') ? 'tripwire' : 'location',
    id: element.dataset.nodeId ?? element.dataset.slotId ?? element.innerText.replace(/\s+/g, ' ').trim(),
    rect: rectFor(element),
  }))
  const overlaps = []
  let minimumClearance = Infinity
  for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
      const left = elements[leftIndex]
      const right = elements[rightIndex]
      const overlapWidth = Math.max(0, Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left))
      const overlapHeight = Math.max(0, Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top))
      const area = overlapWidth * overlapHeight
      if (area > 0) overlaps.push({ left: left.id, right: right.id, overlapWidth, overlapHeight, area })
      const horizontalGap = Math.max(left.rect.left - right.rect.right, right.rect.left - left.rect.right, 0)
      const verticalGap = Math.max(left.rect.top - right.rect.bottom, right.rect.top - left.rect.bottom, 0)
      minimumClearance = Math.min(minimumClearance, Math.max(horizontalGap, verticalGap))
    }
  }
  const canvas = document.querySelector('.viewport-canvas').getBoundingClientRect()
  const outOfBounds = elements.filter(({ rect }) => rect.left < canvas.left - .5 || rect.right > canvas.right + .5 || rect.top < canvas.top - .5 || rect.bottom > canvas.bottom + .5)
  return {
    innerWidth,
    innerHeight,
    bodyScrollWidth: document.body.scrollWidth,
    locationCount: elements.filter(({ kind }) => kind === 'location').length,
    tripwireCount: elements.filter(({ kind }) => kind === 'tripwire').length,
    overlaps,
    maximumOverlapArea: overlaps.reduce((maximum, overlap) => Math.max(maximum, overlap.area), 0),
    minimumClearance: Number.isFinite(minimumClearance) ? minimumClearance : null,
    outOfBounds,
  }
})()`

const sourceBeforeExpression = String.raw`(() => {
  const scroller = document.querySelector('.inspector-scroll')
  scroller.scrollTop = 0
  const inspector = document.querySelector('.inspector-panel').getBoundingClientRect()
  const jump = document.querySelector('[data-testid="evidence-jump"]')
  const evidence = scroller.querySelector('.evidence-block')
  if (!jump || !evidence) return null
  const jumpRect = jump.getBoundingClientRect()
  const evidenceRect = evidence.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  return {
    jumpVisible: jumpRect.top >= inspector.top && jumpRect.bottom <= inspector.bottom,
    initialSourceOffset: evidenceRect.top - scrollerRect.bottom,
    scrollerTop: scrollerRect.top,
    scrollerBottom: scrollerRect.bottom,
  }
})()`

const sourceAfterExpression = String.raw`(() => {
  const scroller = document.querySelector('.inspector-scroll')
  const evidence = scroller.querySelector('.evidence-block')
  const evidenceRect = evidence.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  return {
    evidenceTop: evidenceRect.top,
    evidenceBottom: evidenceRect.bottom,
    scrollerTop: scrollerRect.top,
    scrollerBottom: scrollerRect.bottom,
    fullyVisible: evidenceRect.top >= scrollerRect.top - .5 && evidenceRect.bottom <= scrollerRect.bottom + .5,
  }
})()`

async function verifySourceAffordance(client, scenarioId) {
  const before = await client.evaluate(sourceBeforeExpression)
  assert.ok(before, `${scenarioId}: evidence jump and evidence block must exist`)
  assert.equal(before.jumpVisible, true, `${scenarioId}: SOURCE jump must be initially visible`)
  await client.evaluate(`document.querySelector('[data-testid="evidence-jump"]').click()`)
  await delay(20)
  const after = await client.evaluate(sourceAfterExpression)
  assert.equal(after.fullyVisible, true, `${scenarioId}: SOURCE jump must reveal the full first evidence block`)
  return { scenarioId, ...before, ...after }
}

async function verifyMarkerContinuity(client) {
  await selectScenario(client, 'f3')
  const pending = await client.evaluate(String.raw`(async () => {
    const before = [...document.querySelectorAll('.tripwire-marker')]
    window.__fb03MarkerRefs = Object.fromEntries(before.map((element) => [element.dataset.nodeId, element]))
    document.querySelector('[data-scenario-id="f8"]').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const firstPending = [...document.querySelectorAll('.tripwire-marker')]
    const firstPendingSameNodes = firstPending.length === before.length && firstPending.every((element) => window.__fb03MarkerRefs[element.dataset.nodeId] === element)
    await new Promise((resolve) => setTimeout(resolve, 60))
    const current = [...document.querySelectorAll('.tripwire-marker')]
    const sameNodes = firstPendingSameNodes && current.length === before.length && current.every((element) => window.__fb03MarkerRefs[element.dataset.nodeId] === element)
    const staleVisible = current.every((element) => {
      const freshness = element.querySelector('.marker-freshness')
      return freshness?.textContent === 'STALE' && getComputedStyle(freshness).display !== 'none'
    })
    const pendingState = (document.querySelector('.evaluation-state.pending')?.textContent.includes('CHECKING') ?? false)
      && document.querySelector('.viewport-canvas').dataset.evaluationStatus === 'pending'
    current.find((element) => element.dataset.nodeId === 'nose_thermal')?.click()
    return {
      beforeCount: before.length,
      pendingCount: current.length,
      sameNodes,
      staleVisible,
      pendingState,
      clickedNode: document.querySelector('.inspector-panel').dataset.selectedNode,
    }
  })()`)
  assert.deepEqual(pending, {
    beforeCount: 2,
    pendingCount: 2,
    sameNodes: true,
    staleVisible: true,
    pendingState: true,
    clickedNode: 'nose_thermal',
  })
  await client.waitFor(`document.querySelector('.evaluation-state.confirmed') && document.querySelector('[data-scenario-id="f8"]').getAttribute('aria-pressed') === 'true'`, 'F8 confirmation')
  const confirmed = await client.evaluate(String.raw`(() => {
    const current = [...document.querySelectorAll('.tripwire-marker')]
    const result = {
      confirmedCount: current.length,
      sameNodes: current.every((element) => window.__fb03MarkerRefs[element.dataset.nodeId] === element),
      confirmedState: document.querySelector('.viewport-canvas').dataset.evaluationStatus === 'confirmed'
        && current.every((element) => getComputedStyle(element.querySelector('.marker-freshness')).display === 'none'),
    }
    delete window.__fb03MarkerRefs
    return result
  })()`)
  assert.deepEqual(confirmed, { confirmedCount: 2, sameNodes: true, confirmedState: true })
  return { pending, confirmed }
}

async function verifyClickSynchronization(client) {
  await selectScenario(client, 'f8')
  await client.evaluate(`document.querySelector('.tripwire-marker[data-node-id="nose_thermal"]').click()`)
  assert.equal(await client.evaluate(`document.querySelector('.inspector-panel').dataset.selectedNode`), 'nose_thermal', 'tripwire marker click must synchronize inspector')

  await client.evaluate(`document.querySelector('.bom-row[data-node-id="battery_pack"]').click()`)
  assert.equal(await client.evaluate(`document.querySelector('.inspector-panel').dataset.selectedNode`), 'battery_pack', 'BOM click must synchronize inspector')

  await client.evaluate(`document.querySelector('.slot-marker[data-slot-id="fc_bay"]').click()`)
  assert.equal(await client.evaluate(`document.querySelector('.inspector-panel').dataset.selectedNode`), 'fc_board', 'location label click must synchronize inspector')

  await client.evaluate(`document.querySelector('.tripwire-marker[data-node-id="kestrel"]').click()`)
  await client.evaluate(`document.querySelector('.tripwire-card.propagated .rule-meta button').click()`)
  assert.equal(await client.evaluate(`document.querySelector('.inspector-panel').dataset.selectedNode`), 'nose_thermal', 'cause link must synchronize inspector')

  await client.evaluate(`document.querySelector('.bom-row[data-node-id="battery_pack"]').click()`)
  const canvasRect = await client.evaluate(String.raw`(() => {
    const rect = document.querySelector('.viewport-canvas canvas').getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, aspect: rect.width / rect.height }
  })()`)
  const camera = new THREE.PerspectiveCamera(38, canvasRect.aspect, 0.1, 1000)
  camera.position.set(5.3, 3.7, 6.45)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const portWing = new THREE.Vector3(-0.08, -0.01, 1.17)
    .applyEuler(new THREE.Euler(0, -0.08, -0.02))
    .add(new THREE.Vector3(0, 0.08, 0))
    .project(camera)
  const point = {
    x: canvasRect.left + ((portWing.x + 1) * canvasRect.width) / 2,
    y: canvasRect.top + ((1 - portWing.y) * canvasRect.height) / 2,
  }
  assert.equal(await client.evaluate(`document.elementFromPoint(${point.x}, ${point.y})?.tagName`), 'CANVAS', 'raycast point must not be covered by an HTML overlay')
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await delay(30)
  assert.equal(await client.evaluate(`document.querySelector('.inspector-panel').dataset.selectedNode`), 'port_wing', 'canvas click must raycast to the port wing')
  return { marker: 'nose_thermal', bom: 'battery_pack', slot: 'fc_board', cause: 'nose_thermal', raycast: 'port_wing', raycastPoint: point }
}

async function verifyMobileEvidenceReachability(client) {
  await selectScenario(client, 'missing')
  const result = await client.evaluate(String.raw`(() => {
    const jump = document.querySelector('[data-testid="evidence-jump"]')
    jump.scrollIntoView({ block: 'center' })
    jump.click()
    const evidence = document.querySelector('.evidence-block').getBoundingClientRect()
    return { jumpExists: Boolean(jump), evidenceTop: evidence.top, evidenceBottom: evidence.bottom, viewportHeight: innerHeight }
  })()`)
  assert.equal(result.jumpExists, true)
  assert.ok(result.evidenceTop >= -0.5 && result.evidenceTop < result.viewportHeight, 'mobile SOURCE jump must bring evidence into the viewport')
  await client.evaluate(`window.scrollTo(0, 0)`)
  return result
}

async function run() {
  const profile = await mkdtemp(join(tmpdir(), 'tripwire-fb03-chrome-'))
  const viteLog = []
  const chromeLog = []
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(APP_PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  captureOutput(vite, viteLog)
  let chrome
  let client
  try {
    await waitForHttp(APP_URL, 'Vite')
    chrome = spawn(CHROME, [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-default-apps',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    captureOutput(chrome, chromeLog)
    const targets = await (await waitForHttp(`${DEBUG_URL}/json/list`, 'Chrome DevTools')).json()
    const page = targets.find((target) => target.type === 'page')
    assert.ok(page, 'Chrome must expose a page target')
    client = await DevToolsClient.connect(page.webSocketDebuggerUrl)
    await client.send('Page.enable')
    await client.send('Runtime.enable')

    const layoutResults = []
    const sourceResults = []
    let continuity
    let clicks
    let mobileEvidence
    for (const viewport of VIEWPORTS) {
      await client.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 })
      await client.send('Page.navigate', { url: APP_URL })
      await client.waitFor(`document.readyState === 'complete' && document.querySelector('.viewport-canvas canvas')`, `${viewport.width}x${viewport.height} application load`)
      await client.waitFor(`document.querySelectorAll('.tripwire-marker').length === 2`, `${viewport.width}x${viewport.height} WebGL overlays`, 15_000)
      for (const scenarioId of SCENARIOS) {
        await selectScenario(client, scenarioId)
        const layout = await client.evaluate(layoutExpression)
        assert.equal(layout.innerWidth, viewport.width)
        assert.equal(layout.innerHeight, viewport.height)
        assert.ok(layout.bodyScrollWidth <= viewport.width, `${viewport.width}x${viewport.height} ${scenarioId}: body must not scroll horizontally`)
        assert.equal(layout.locationCount, 5, `${viewport.width}x${viewport.height} ${scenarioId}: all five location labels must be visible`)
        assert.equal(layout.tripwireCount, EXPECTED_TRIPWIRES[scenarioId], `${viewport.width}x${viewport.height} ${scenarioId}: unexpected tripwire count`)
        assert.equal(layout.maximumOverlapArea, 0, `${viewport.width}x${viewport.height} ${scenarioId}: marker bounding boxes overlap: ${JSON.stringify(layout.overlaps)}`)
        assert.deepEqual(layout.outOfBounds, [], `${viewport.width}x${viewport.height} ${scenarioId}: markers must remain inside the model viewport`)
        layoutResults.push({ viewport: `${viewport.width}x${viewport.height}`, scenarioId, ...layout })
        if (viewport.width === 1280) sourceResults.push(await verifySourceAffordance(client, scenarioId))
      }
      if (viewport.width === 1280) {
        continuity = await verifyMarkerContinuity(client)
        clicks = await verifyClickSynchronization(client)
      }
      if (viewport.mobile) mobileEvidence = await verifyMobileEvidenceReachability(client)
    }

    const version = await (await fetch(`${DEBUG_URL}/json/version`)).json()
    process.stdout.write(`Chrome: ${version.Browser}\n`)
    for (const result of layoutResults) {
      process.stdout.write(`${result.viewport} ${result.scenarioId}: locations=${result.locationCount}, tripwires=${result.tripwireCount}, max-overlap=${result.maximumOverlapArea.toFixed(2)}px², min-clearance=${result.minimumClearance.toFixed(2)}px\n`)
    }
    for (const result of sourceResults) {
      process.stdout.write(`1280x720 ${result.scenarioId} source: initial-offset=${result.initialSourceOffset.toFixed(2)}px, jump-visible=${result.jumpVisible}, revealed=${result.fullyVisible}\n`)
    }
    process.stdout.write(`F3→F8 marker continuity: pending=${continuity.pending.sameNodes}, confirmed=${continuity.confirmed.sameNodes}, stale-visible=${continuity.pending.staleVisible}, pending-click=${continuity.pending.clickedNode}\n`)
    process.stdout.write(`Click synchronization: ${JSON.stringify(clicks)}\n`)
    process.stdout.write(`390x844 source reachability: ${JSON.stringify(mobileEvidence)}\n`)
  } catch (error) {
    const diagnostics = [...viteLog.slice(-8), ...chromeLog.slice(-8)].join('').trim()
    if (diagnostics) process.stderr.write(`\nProcess diagnostics:\n${diagnostics}\n`)
    throw error
  } finally {
    client?.close()
    chrome?.kill('SIGTERM')
    vite.kill('SIGTERM')
    await rm(profile, { recursive: true, force: true })
  }
}

await run()
