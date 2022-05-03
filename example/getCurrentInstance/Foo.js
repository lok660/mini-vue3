import { h, getCurrentInstance } from "../../lib/guide-mini-vue.esm.js";

export const Foo = {
  name: "Foo",
  setup () {
    const instance = getCurrentInstance()
    console.log('Foo->getCurrentInstance', instance);
  },
  render () {
    const foo = h("p", {}, "123");
    return h("div", {}, [foo]);
  },
};
