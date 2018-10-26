const fs = require('fs')
const child_process = require('child_process')
const crypto = require('crypto')
const util = require('util')
const glob = require('glob')
const handlebars = require('handlebars')
const YAML = require('yamljs')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const exec = util.promisify(child_process.exec)
const globAsync = util.promisify(glob)

handlebars.registerHelper('eq', (a, b) => a == b)


async function run() {
  const reloads = new Set()
  const config = YAML.parse(await readFile('./config.yml', 'utf8'))
  const data = YAML.parse(await readFile('./data.yml', 'utf8'))
  const modules = new Proxy({}, {
    get (target, name) {
      target[name] = target[name] || require(`./modules/${name}`)
      return target[name]
    }
  })
  for (const file of config.files) {
    console.log(`Checking ${file.dest}...`)
    const oldData = await tryRead(file.dest)
    if (oldData === '') {
      console.log(`WARN: ${file.dest} file doesn't exist`)
    }
    data[file.key] = data[file.key] || {}
    //await Promise.all((file.modules || []).map(async m => {
    for(const m of file.modules) {
      data[file.key] = await modules[m](file, data[file.key]) || data[file.key]
    }
    //}))
    const template = handlebars.compile(file.template || await readFile(file.src, 'utf8'), { noEscape: true })
    const out = template(data[file.key])
    const newHash = sha256(out)
    const oldHash = sha256(oldData)
    if (oldHash !== newHash) {
      console.log(`${file.key} hashes differ ${oldHash} !== ${newHash}`)
      await writeFile(file.dest, out)
      if (file.reloadCmd) {
        reloads.add(file.reloadCmd)
      }
    }
  }
  for(const cmd of reloads) {
  	console.log(`Executing: ${cmd}`)
    const { stdout, stderr } = await exec(cmd, { cwd: __dirname })
    process.stdout.write(stdout)
    process.stderr.write(stderr)
  }
}

async function tryRead(file) {
  try {
    return await readFile(file, 'utf8')
  } catch(err) {
    return ''
  }
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

run().catch(console.log)