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
        class: ['red', 'blue'],
        onClick () {
          console.log('click')
        },
        onMousedown () {
          console.log('onmouserdown')
        },
      },

      [h('div', {}, 'hi:' + this.msg), h(Foo, { count: 1 })]
      /**
       *  我们需要通过一个媒介 this 同时获取到setupState 和 this.$el（其实就是返回根节点 get root ele）里的内容
       */
      // "HI" + this.msg
      // "hi mini-Vue" // string
      // array
      // [h("p", { class: "red" }, "hi"), h("p", { class: "yellow" }, "mini - vue"),]
    )
  },

  setup () {
    // composition api

    return {
      msg: '---mini-vue---',
    }
  },
}
