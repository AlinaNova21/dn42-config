const child_process = require('child_process')
const fs = require('fs')
const util = require('util')

const exec2 = util.promisify(child_process.exec)
const exec = (cmd) => {
  console.log(`exec: '${cmd}'`)
  return exec2(cmd)
}
const readFile = util.promisify(fs.readFile)

const PID = process.pid
const NETNS=`/proc_1_ns_net`
const NS=`nsenter --net=${NETNS} --no-fork`

const BRIDGE_NETS_V4 = [
  '172.20.0.0/14',
  '10.100.0.0/14',
  '10.0.0.0/8',
  '172.31.0.0/16'
]
const BRIDGE_NETS_V6 = [
  'fd00::/8'
]

async function run() {
  setInterval(tick, 300000)
  await tick()
}

async function tick () {
  const config = await loadConfig()
  try { await exec(`ip addr add "${config.ipv4}/32" dev lo`) } catch(e) {}
  try { await exec(`ip addr add "${config.ipv6}/128" dev lo`) } catch(e) {}
  try { await exec(`ip addr add "${config.localipv6}/128" dev lo`) } catch(e) {}
  if(!await hasInterface('host0')) {
		await createHostLink(config)
  }
  for(const peer of config.peers) {
    try {
      console.log(`Checking ${peer.interface}...`)
      if(!await hasInterface(peer.interface)) {
        await createInterface(peer.interface)
        await configureInterface(config, peer)
      }
    } catch(err) {
      console.log(`Error for interface ${peer.interface}: ${err}`)
      await removeInterface(peer.interface)
    }
  }
  console.log('Checks complete')
}

async function loadConfig() {
  return JSON.parse(await readFile('/data/wireguard/config.json', 'utf8'))
}

async function createHostLink(config) {
	const randnet = require('crypto').randomBytes(2).toString('hex')
	const hostv6 = `fd42:465:1337:${randnet}::2`
	const localv6 = `fd42:465:1337:${randnet}::1`
	//const randv6 = require('crypto').randomBytes(8).toString('hex').replace(/(.{4})/g, ':$1').slice(1)
	//const hostv6 = `fd42:465:1337:4242:${randv6}`
	//const linkv6 = `fe80::${randv6}`
	await exec(`${NS} ip link add dn0 type veth peer name host0`)
	await exec(`${NS} ip link set dev host0 netns ${PID}`)
	await exec(`${NS} ip addr add 169.254.42.2/32 dev dn0 peer 169.254.42.1`)
	await exec(`${NS} ip -6 addr add ${hostv6}/64 dev dn0`)
	//await exec(`${NS} ip -6 addr add ${linkv6}/64 dev dn0`)
	await exec(`${NS} ip link set dev dn0 up`)
	await exec(`ip addr add 169.254.42.1/32 dev host0 peer 169.254.42.2`)
	await exec(`ip -6 addr add ${localv6}/64 dev host0`)
	await exec(`ip link set dev host0 up`)
	//await exec(`ip -6 r a ${hostv6} dev host0 via ${linkv6}`)

	for (const net of BRIDGE_NETS_V4) {
		try { await exec(`${NS} ip r a ${net} dev dn0 via 169.254.42.1`) } catch(e) {}
		try { await exec(`iptables -t nat -A POSTROUTING -s 169.254.42.2/32 -d ${net} -j MASQUERADE`) } catch(e) {}
	}

	for (const net of BRIDGE_NETS_V6) {
		await exec(`${NS} ip -6 r a ${net} dev dn0 via ${localv6}`)
	}
}

async function hasInterface(name) {
  try {
    const { stdout, stderr } = await exec(`ip link show dev "${name}"`)
    return true
  } catch (e) {
    return false
  }
}

async function configureInterface(config, peer) {
  let conf = `private-key /data/wireguard/private.key peer "${peer.publicKey}" allowed-ips "0.0.0.0/0, ::/0"`
  if (peer.endpoint) conf += ` endpoint "${peer.endpoint}"`
  if (peer.listenPort) conf = `listen-port ${peer.listenPort} ${conf}`
  await exec(`wg set "${peer.interface}" ${conf}`)
  await exec(`ip link set dev "${peer.interface}" up`)
  let v4addr = `ip addr add "${config.ipv4}" dev "${peer.interface}"`
  if (peer.ipv4) {
    v4addr += ` peer ${peer.ipv4}/32`
  }
  await exec(v4addr)
  await exec(`ip addr add "${config.localipv6}/64" dev "${peer.interface}"`)
  if (peer.ipv6) {
    await exec(`ip route add "${peer.ipv6}" dev "${peer.interface}"`)
  }
}

async function createInterface(name) {
  await removeInterface(name)
  console.log(`Creating ${name}`)
  await exec(`${NS} ip link add dev "${name}" type wireguard`)
  await exec(`${NS} ip link set dev "${name}" netns ${PID}`)
}

async function removeInterface(name) {
  if (await hasInterface(name)) {
    console.log(`Removing ${name}`)
    await exec(`ip link del "${name}"`)
  }
}

run().catch(console.error)