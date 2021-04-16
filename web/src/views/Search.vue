<template>
  <v-container>
    <v-row>
      <v-col cols="4">
        Query<br/>{{DecodedQuery}}
      </v-col>
      <v-col cols="8">
        <div v-for="set in QnsAnswers" :key="set.id">
          <v-card>
            <v-card-text>
              <div class="question" v-html="markTerms(set.question, set.terms)"></div>
              <div v-html="markTerms(set.answer, set.terms)"></div>
            </v-card-text>
          </v-card>
          <br/>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.question {
  font-weight: bold;
}
.term {
  color: #ff0000;
}
</style>

<script>
// @ is an alias to /src
// import Search from '@/components/HelloWorld.vue'
import axios from 'axios'

export default {
  name: 'Search',
  props: ['EncodedQuery'],
  data() {
    return {
      QnsAnswers: [],
    }
  },
  mounted() {
    this.search(this.$route.params.EncodedQuery)
  },
  computed: {
    DecodedQuery() {
      let ret = Buffer.from(this.$route.params.EncodedQuery, 'base64')
      return ret.toString('utf8')
    }
  },
  methods: {
    markTerms(text, terms) {
      const blocklist = ['i']
      terms.forEach((term) => {
        if (term.length < 3 || blocklist.includes(term.toLowerCase())) {
          return
        }

        text = text.replaceAll(term, `<span style="color: #ff0000">${term}</span>`)
      })
      return text
    },
    async search(EncodedQuery) {
      let resp = await axios.get('https://answerbot.kungfoo.info/search/' + EncodedQuery)
      console.log(resp.data)
      this.QnsAnswers = resp.data
    }
  }
}
</script>
