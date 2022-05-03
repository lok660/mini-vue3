window.self = null
import { h } from '../../lib/guide-mini-vue.esm.js'
import { Foo } from './Foo.js'

export const App = {
  name: 'App',

  render () {
    window.self = this
    // ui
    return h(
      'div',
      {
        id: 'root',
        class: 'red',
        onClick () {
          console.log('click')
        },
        onMousedown () {
          console.log('onmouserdown')
        },
      },

      [
        h('div', {}, 'hi:' + this.msg),
        h(Foo, { count: 1 })
      ]
    )
  },

  setup () {
    return {
      msg: 'mini-vue',
    }
  },
}
