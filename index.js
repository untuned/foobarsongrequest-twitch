/* // Load dependencies
// const fs = require('fs')
const request = require('request')
const tmi = require('tmi.js')

// Set static variables
const config = require('./config.json')
const botUsername = config.username
const botOauth = config.oauth
const botChannel = config.channel
const prefix = config.prefix

// TMI
const options = {
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: botUsername,
    password: botOauth
  },
  channels: [botChannel]
}
const client = tmi.client(options)

// const songCooldown = config.songCooldown
// const userCooldown = config.userCooldown

let foobarPlaylist
let songs = []
let currentSong = ['', '']; let previousSong = ['', '']

console.log('> Loading playlist...')
request({
  url: 'http://127.0.0.1:8888/playlistviewer/?param3=playlist.json',
  json: true
}, function (error, response, body) {
  console.log(`error: ${error} response: ${response} body: ${body}`)
  if (!error && response.statusCode === 200) {
    foobarPlaylist = body
  } else {
    console.error('> Unable to load playlist.')
    process.exit(1)
  }
})
console.log('> Playlist loaded.')

console.log('> Parsing playlist...')
songs = songs.concat(foobarPlaylist.split('</br>'))
for (let i = 0; i < songs.length; i++) {
  if (songs[i].indexOf('">') !== -1) {
    songs[i] = songs[i].split('">')[1].replace(/['"]/g, '')
    console.log(songs[i])
  }
}
console.log('> Playlist parsed.')

console.log('> Connecting to Twitch...')
client.connect()
  .then((data) => {
    console.log(`> Connected.`)
  }).catch((err) => {
  console.error(err)
})

// Get current song
function getCurrentSong () {
  request({
    url: 'http://127.0.0.1:8888/playlistviewer/?param3=nowPlaying.json',
    json: true
  }, function (err, response, body) {
    if (!err && response.statusCode === 200) {
      const pCurrentSong = currentSong
      currentSong = [body.artist, body.title]

      if (currentSong[0] === '' && currentSong[1] === '') return
      if (pCurrentSong[0] !== currentSong[0] || pCurrentSong[1] !== currentSong[1]) {
        previousSong = currentSong
        if (currentSong[0] !== '?') {
          console.log('> New song: ' + currentSong[0] + ' - "' + currentSong[1] + '"')
        } else {
          console.log('> New song: "' + currentSong[1] + '"')
        }
      }
    }
  })
  setTimeout(getCurrentSong, 10000)
}

getCurrentSong()

client.on('chat', (channel, userState, message, self) => {
  if (self) return
  const username = userState.username

  const args = message.slice(prefix.length).trim().split(/ +/g)
  const command = args.shift().toLowerCase()

  if (command === 'ping' && username === botChannel) {
    client.say(channel, 'Pong!')
      .catch((err) => {
        console.error(err)
      })
  }

  if (command === 'song' ||
  command === 'currentsong' ||
  command === 'nowplaying' ||
  command === 'np') {
    request({
      url: 'http://127.0.0.1:8888/playlistviewer/?param3=nowPlaying.json',
      json: true
    }, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        if (body.isPlaying === 1) {
          if (currentSong[0] !== '?') {
            client.say(channel, `[@${username}] Currently playing: ${currentSong[0]} - "${currentSong[1]}"`)
              .catch((err) => {
                console.error(err)
              })
          } else {
            client.say(channel, `[@${username}] Currently playing: "${currentSong[1]}"`)
              .catch((err) => {
                console.error(err)
              })
          }
        } else {
          client.say(channel, `[@${username}] No song playing.`)
            .catch((err) => {
              console.error(err)
            })
        }
      }
    })
  }
})
*/

// Load dependencies
const fs = require('fs')
const request = require('request')
const tmi = require('tmi.js')

// Load config
const config = require('./config.json')
const botUsername = config.username
const botOauth = config.oauth
const botChannel = config.channel
const prefix = config.prefix

// TMI options
const options = {
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: botUsername,
    password: botOauth
  },
  channels: [botChannel]
}
const client = tmi.client(options)

// Foobar2000 information
let playlist
let songs = []
let currentSong = ['', '']

// Cooldowns
let songsInCooldown = []
let usersInCooldown = []

// functions
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getPlaylist () {
  return new Promise(function (resolve, reject) {
    request('http://127.0.0.1:8888/playlistviewer/?param3=playlist.json', { json: true }, function (error, response, body) {
      if (error) return reject(error)
      resolve(body)
    })
  })
}

function getSong () {
  return new Promise(function (resolve, reject) {
    request('http://127.0.0.1:8888/playlistviewer/?param3=nowPlaying.json', { json: true }, function (error, response, body) {
      if (error) return reject(error)
      resolve(body)
    })
  })
}

async function main () {
  try {
    console.log('> Loading playlist...')
    playlist = await getPlaylist()
    console.log('> Playlist loaded.')
    await sleep(1000)

    console.log('> Parsing playlist...')
    songs = songs.concat(playlist.split('</br>'))
    for (let i = 0; i < songs.length; i++) {
      if (songs[i].indexOf('">') !== -1) {
        songs[i] = songs[i].split('">')[1].replace(/['"]/g, '')
        // console.log(songs[i])
      }
    }
    console.log(`> Playlist parsed. ${songs.length} songs in the playlist.`)
    await sleep(1000)

    console.log('> Connecting to Twitch IRC...')
    await client.connect().then(() => {
      console.log('> Connected.')
    }).catch((err) => {
      console.error(err)
    })

    client.on('chat', async function (channel, user, message, self) {
      if (self) return
      const username = user['username']
      const displayName = user['display-name']
      message = message.toLowerCase()

      const date = new Date()
      const year = date.getFullYear()
      let month = String(date.getMonth() + 1)
      let day = String(date.getDate())

      const hour = date.getHours()
      const minute = date.getMinutes()
      const seconds = date.getSeconds()

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      if (month.length === 1) {
        month = '0' + month
      }
      if (day.length === 1) {
        day = '0' + day
      }

      fs.appendFile(`log_${day}-${month}-${year}.log`, `\r\n[${hour}:${minute}:${seconds} ${timezone}] ${username}: ${message}`, function (err) {
        if (err) {
          console.error(err)
        }
      })

      const args = message.slice(prefix.length).trim().split(/ +/g)
      const command = args.shift().toLowerCase()

      if (command === 'ping' && username === botChannel) {
        client.say(channel, `[@${displayName}] Pong!`)
          .catch((err) => {
            console.error(err)
          })
      }

      if (command === 'song' || command === 'nowplaying' || command === 'np' || command === 'currentsong') {
        let songBody = await getSong()
        currentSong = [songBody.artist, songBody.title]

        if (songBody.isPlaying === '1') {
          if (currentSong[0] !== '?') {
            await client.say(channel, `[@${displayName}] Current song: ${currentSong[0]} - "${currentSong[1]}"`)
          } else {
            await client.say(channel, `[@${displayName}] Current song: "${currentSong[1]}"`)
          }
        } else {
          await client.say(channel, `[@${displayName}] No song playing.`)
        }
      }

      if(command === 'songrequest' || command === 'sr' || command === 'songreq') {
        for (let i = 0; i < args.length; i++) {
          args[i] = args[i].replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, '').toLowerCase()
        }

        let songIndex = -1
        let songPossible = []
        if (args.length === 0) {
          await client.say(channel, `[@${displayName}] Request songs with "!${command} name". Only songs from the Monstercat catalogue are available, excluding remixes and non-licensable tracks.`)
          return
        }
        for (let i = 0; i < songs.length; i++) {
          let searching = true

          for (let j = 0; j < args.length; j++) {
            if (songs[i].toLowerCase().indexOf(args[j]) === -1 && args[j] !== '***') searching = false
          }
          if (searching) {
            songPossible.push(i)
          }
        }

        if (songPossible.length > 1) {
          let songPossibleNoRemix = []
          for (let i = 0; i < songPossible.length; i++) {
            if (songs[songPossible[i]].toLowerCase().indexOf('remix') === -1 && songs[songPossible[i]].toLowerCase().indexOf('acapella') === -1) {
              songPossibleNoRemix.push(songPossible[i])
            }
          }
          if (songPossibleNoRemix.length > 1) {
            songIndex = songPossibleNoRemix[Math.floor(Math.random() * songPossibleNoRemix.length)]
          } else {
            songIndex = songPossible[Math.floor(Math.random() * songPossible.length)]
          }
          await client.say(channel, `[@${displayName}] ${songPossible} songs found from query.`)
        } else {
          songIndex = songPossible[0]
        }
        if (songPossible.length > 0) {

        }
      }
    })
    // end code for bot
  } catch (err) {
    console.error(err)
  }
}
main()
  .catch((err) => {
    console.error(err)
  })

process.on('SIGINT', function () {
  console.log('> Caught interrupt signal. Exiting...')
  client.disconnect()
    .then(() => {
      console.log('> Disconnected from Twitch IRC.')
      process.exit()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
})
