const fs = require('fs')
const child_process = require('child_process')
const util = require('util')
const path = require('path')
const axios = require('axios')
const Glob = require('glob')

const readFile = util.promisify(fs.readFile)
const readdir	=	util.promisify(fs.readdir)
const exec = util.promisify(child_process.exec)
const glob = util.promisify(Glob)

let cache = null

module.exports = async (config, data) => {
  if (!cache) {
  	const { stdout, stderr } = await exec('git pull', { cwd: path.resolve('registry') })
    process.stdout.write(`Registry GIT: ${stdout}`)
    process.stderr.write(`Registry GIT: ${stderr}`)
  
    const ipv4 = parseFilter(await readFile('registry/data/filter.txt', 'utf8'))
    const ipv6 = parseFilter(await readFile('registry/data/filter6.txt', 'utf8'))
    const { route4, route6 } = await roaImport()
    const exports = JSON.stringify({
      roas: [...route4, ...route6].map(r => ({
        asn: r.as,
        prefix: `${r.prefix}/${r.subnet}`,
        maxLength: r.max,
        ta: ''
      }))
    }, null, 2)
    cache = {
      validNets: { ipv4, ipv6 },
      route4, route6,
      exports
    }
  }
  data.dn42 = cache
}

module.exports.testROA = async () => {
	const start = Date.now()
  const { route4, route6 } = await roaImport2()
  const end = Date.now()
  console.log(end-start, route4.length, route6.length)
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
  const route4 = parseRoutes(await Promise.all(route4files.map(f => readFile(f, 'utf8'))), false)
  const route6 = parseRoutes(await Promise.all(route6files.map(f => readFile(f, 'utf8'))), true)
  return { route4, route6 }
} 

async function roaImport2 () {
  const route4files = await getFiles('registry/data/route/')
  const route6files = await getFiles('registry/data/route6/')
  const route4 = await parseRoutes2(route4files, false)
  const route6 = await parseRoutes2(route6files, true)
  return { route4, route6 }
} 

async function getFiles(dir) {
	const files = await readdir(dir)
	return files.map(f => path.join(dir, f))
}

function parseFile(data) {
	const ret = {}
	let lastArr = []
	let val = ''
	const lines = data.split('\n')
	for(let i=0;i<lines.length;i++) {
		const key = lines[i].slice(0,20).trim().slice(0,-1)
		const dat = lines[i].slice(20).trim()
		switch (key[0]) {
			case ' ':
				lastArr[lastArr.length - 1] += dat
				break;
			case '+':
				lastArr[lastArr.length - 1] += '\n'
				break;
			default:
				lastArr = ret[key] = ret[key] || []
				ret[key].push(dat)
				break;
		}
	}
	return ret
}

async function parseRoutes2 (routeFiles, ipv6 = false) {
  const out = []
  await Promise.all(routeFiles.map(async file => {
  	const fileData = await readFile(file, 'utf8')
		const data = parseFile(fileData)
    const [,prefix,subnet] = (data.route || data.route6)[0].match(/^(.+?)\/(\d+)$/)
    const origins = data.origin.map(o => o.slice(2))
    const max = Math.max(parseInt(subnet), ipv6 ? 64 : 28)
    origins.forEach(as => {
      out.push({ prefix, subnet, max, as })
    })
  }))
  return out
}
function parseRoutes (routes, ipv6 = false) {
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
    const max = Math.max(parseInt(subnet), ipv6 ? 64 : 29)
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
