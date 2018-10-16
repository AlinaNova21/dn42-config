const fs = require('fs')
const child_process = require('child_process')
const util = require('util')
const path = require('path')
const axios = require('axios')
const Glob = require('glob')

const readFile = util.promisify(fs.readFile)
const exec = util.promisify(child_process.exec)
const glob = util.promisify(Glob)

module.exports = async (config, data) => {
	const { stdout, stderr } = await exec('git pull', { cwd: path.resolve('registry') })
  process.stdout.write(`Registry GIT: ${stdout}`)
  process.stderr.write(`Registry GIT: ${stderr}`)

  const ipv4 = parseFilter(await readFile('registry/data/filter.txt', 'utf8'))
  const ipv6 = parseFilter(await readFile('registry/data/filter6.txt', 'utf8'))
  const { route4, route6 } = await roaImport()
  data.dn42 = {
    validNets: { ipv4, ipv6 },
    route4, route6
  }
}

function parseFilter (data) {
  return data
    .split('\n')
    .filter(d => d.match(/^\d/))
    .map(l => l.match(/^(\d+)\s+(\w+)\s+(.+?)\s+(\d+)\s+(\d+)\s+# (.+?)$/))
    .map(([,nr,action,prefix,minlen,maxlen,comment]) => ({ nr,action,prefix,minlen,maxlen,comment }))
    .filter(i => i.action === 'permit')
}

async function roaImport () {
  const route4files = await glob('registry/data/route/*')
  const route6files = await glob('registry/data/route6/*')
  const route4 = parseRoutes(await Promise.all(route4files.map(f => readFile(f, 'utf8'))))
  const route6 = parseRoutes(await Promise.all(route6files.map(f => readFile(f, 'utf8'))))
  return { route4, route6 }
} 

function parseRoutes (routes) {
  const out = []
  routes.forEach(r => {
    const data = r.split("\n")
    	.map(l => [l.slice(0,20).trim().slice(0,-1),l.slice(20)])
    	.filter(([k]) => k)
    	.reduce((ret, [k,v]) => {
    		ret[k] = ret[k] || []
    		ret[k].push(v)
    		return ret
    	}, {})
    const [,prefix,subnet] = (data.route || data.route6)[0].match(/^(.+?)\/(\d+)$/)
    const origins = data.origin.map(o => o.slice(2))
    const max = Math.max(parseInt(subnet), 29)
    origins.forEach(as => {
      out.push({ prefix, subnet, max, as })
    })
  })
  return out
}
// */15 * * * * 
// curl -sfSLR {-o,-z}/etc/bird/roa_dn42_v6.conf https://dn42.tech9.io/roa/bird6_roa_dn42.conf 
// curl -sfSLR {-o,-z}/etc/bird/roa_dn42.conf https://dn42.tech9.io/roa/bird_roa_dn42.conf 
// sed -i 's/roa/route/g' /etc/bird/roa_dn42{,_v6}.conf 
// birdc configure
