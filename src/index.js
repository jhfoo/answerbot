const fs = require('fs'),
  process = require('process'),
  Koa = require('koa'),
  Router = require('@koa/router'),
  Static = require('koa-static-server'),
  axios = require('axios'),
  MiniSearch = require('minisearch')

var SlackWebhookUrl = ''

let search = new MiniSearch({
  fields: ['question', 'answer'],
  storeFields: ['question', 'answer'],
  searchOptions: {
    boost: {
      question: 2,
    },
  }
})

function loadData() {
  return new Promise((resolve, reject) => {
    fs.readFile('./data/qna.txt', 'utf8', (err, data) => {
      if (err) {
        reject(err)
      }
    
      let id = 1
      let doc = {
        id: id++
      }
      data.split('\n').forEach((line) => {
        line = line.trim()
        console.log(`=> ${line}`)
        if (line.length === 0) {
          if ('question' in doc && 'answer in doc') {
            search.add(doc)
            doc = {
              id: id++
            }
          }
        } else if (!('question' in doc)) {
          console.log('Question')
          doc.question = line
        } else {
          console.log('Answer')
          doc.answer = line
        }
      })

      if ('answer' in doc) {
        search.add(doc)
      }

      resolve()
    })
  })
}

async function getSlackWebhook() {
  let resp = await axios.get('http://consul-teller.node.consul:8500/v1/kv/answerbot/slack-webhook')
  return resp.data[0].Value
}

function filteredSearch(query) {
  const blocklist = ['how','i','to']
  let FilteredArray = []
  let QueryArray = query.split(/\s+/)
  QueryArray.forEach((word) => {
    if (word.length > 3) {
      FilteredArray.push(word)
    }
  })

  return search.search(FilteredArray.join(' '))
}

loadData().then(async () => {
  console.log('Test search:')
  console.log(search.search('how to disable feature toggle'))
  SlackWebhookUrl = await getSlackWebhook()
  let buf = Buffer.from(SlackWebhookUrl, 'base64')
  SlackWebhookUrl = buf.toString('utf8')
  console.log(SlackWebhookUrl)
})


const app = new Koa()
app.use(require('koa-bodyparser')())
app.use(require('@koa/cors')())
app.use(Static({
  rootDir: 'public',
  rootPath: '/web'
}))
const router = new Router();

router.get('/search/:EncodedQuery', (ctx, next) => {
  let EncodedQuery = Buffer.from(ctx.params.EncodedQuery, 'base64')
  let ret = filteredSearch(EncodedQuery.toString('utf8'))
  if (ret.length > 5) {
    ret.splice(5)
  }
  ctx.body = ret
})

router.get('/slack/', (ctx, next) => {
  console.log('Incoming event')
  ctx.body = 'hello'
})

var HandledEventIds = {}

async function handleEvent(ctx) {
  if (ctx.request.body.event.type === 'message') {
    console.log(`Message: ${ctx.request.body.event.text}`)
    if ('subtype' in ctx.request.body.event || HandledEventIds[ctx.request.body.event_id]) {
      console.log('Ignoring event')
    } else {
      let results = filteredSearch(ctx.request.body.event.text)
      console.log(results)
      console.log('Sending message')
      let buf = Buffer.from(ctx.request.body.event.text, 'utf8')
      console.log(SlackWebhookUrl)
      await axios.post(SlackWebhookUrl, {
        text: `I found a similar question:\n` + 
          `${results[0].question}\n\n` +
          `Answer: ${results[0].answer}\n\n` +
          `Not the answer you're looking for? You can find other possible answers here: https://answerbot.kungfoo.info/web/#/search/${buf.toString('base64')}.`,
        thread_ts: ctx.request.body.event.ts,
      })
      HandledEventIds[ctx.request.body.event_id] = 1
    }
  } 
  // else
  ctx.body = 'ok'
}

function handleChallenge(ctx) {
  ctx.body = ctx.request.body.challenge
}

router.post('/slack/', async (ctx) => {
  console.log(ctx.request.body)
  if (ctx.request.body.token === '0IcJsSFo2ZwgRmdM3cWVISIG') {
    if ('challenge' in ctx.request.body) {
      handleChallenge(ctx)
    } else {
      await handleEvent(ctx)
    }
  } else {
    ctx.body = '?'
  }
})

app
  .use(router.routes())
  .use(router.allowedMethods())
app.listen(8000)