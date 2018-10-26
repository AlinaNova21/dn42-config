const dns = require('dns')
const child_process = require('child_process')
const util = require('util')

const lookup = util.promisify(dns.lookup)
const exec = util.promisify(child_process.exec)

module.exports = async (config, data) => {
  data.netsets = {
    ipv4: `[${data.nets.ipv4.join(',')}]`,
    ipv6: `[${data.nets.ipv6.join(',')}]`,
  }
  data.peers = data.peers
    .map(peer => {
      peer.type = peer.type || 'dnpeers'
      if (peer.wireguard) {
        peer.wireguard.listenPort = peer.wireguard.listenPort || parseInt(peer.as.slice(-5))
        peer.wireguard.interface = `wg-peer-${peer.name}`.slice(0,15)
      }
      return peer
    })
    .filter(p => p.enabled)
  data.ibgp = data.ibgp
    .map(peer => {
      peer.as = data.as
      peer.type = peer.type || 'iBGP_Peer'
      peer.multiChannel = 'ipv4'
      if (peer.wireguard) {
        peer.wireguard.listenPort = peer.wireguard.listenPort || parseInt(peer.as.slice(-5))
        peer.wireguard.interface = `wg-int-${peer.name}`.slice(0,15)
      }
      return peer
    })
    .filter(p => p.enabled)
  data.allPeers = [...data.ibgp, ...data.peers]
  for (const p of data.allPeers) {
		if(p.wireguard && p.wireguard.endpoint) {
			const [host,port] = p.wireguard.endpoint.split(':')
			const { address } = await lookup(host, { verbatim: true })
			p.wireguard.endpoint = `${address || host}:${port}`
			p.cryptoType = 'wireguard'
      p.crypto = 'pfs'
      p.speed = p.speed || 100
      p.latency = p.latency || await ping(address || host)
		}
		if (p.latency && p.speed && p.crypto) {
			p.filter = [latencyClass(p.latency), speedClass(p.speed), cryptoClass(p.crypto)]
		}
  }
  data.wgConfig = JSON.stringify({
    ipv4: data.ipv4,
    ipv6: data.ipv6,
    localipv6: data.localipv6,
    peers: data.allPeers
      .filter(p => p.wireguard)
      .map(p => {
        const wg = p.wireguard
        wg.ipv4 = p.ipv4
        wg.ipv6 = p.ipv6
        return wg 
      })
  })
}


function latencyClass(lat) {
  if (lat < 2.7) return 1
	if (lat < 7.3) return 2
	if (lat < 20) return 3
	return Math.round(Math.log(lat))
}

function speedClass(spd) {
	if (spd === 0) throw new Error(`invalid speed ${spd}`)
	if (spd < 1) return 21
	if (spd < 10) return 22
	if (spd < 100) return 23
	if (spd < 1000) return 24
	if (spd < 10000) return 25
	return 20 + Math.round(Math.log10(spd * 100))
}

function cryptoClass(cr) {
	if (cr === 'unencrypted') return 31
	if (cr === 'unsafe') return 32
	if (cr === 'encrypted') return 33
	if (cr === 'pfs') return 34
	throw new Error(`unknown type ${cr}`)
}

async function ping(host, ipv6 = false) {
	try {
		console.log(`Pinging ${host}`)
		ipv6 |= host.includes(':')
	  const { stdout, stderr } = await exec(`ping ${ipv6?'-6':'-4'} -W10 -c5 ${host}`)
	 	const latency = parseInt(stdout.split('\n').slice(-2)[0].split('/')[5])
	  console.log(`Ping complete: ${latency} ms`)
	  return latency
	} catch(e) {
	  throw new Error(`ping failed:\n${e.stdout}\n${e.stderr} ${e}`)
	}
}