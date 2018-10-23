#!/bin/env node
const net = require('net')
const client = net.connect('/var/run/bird.ctl')
client.write('configure')
client.end()
