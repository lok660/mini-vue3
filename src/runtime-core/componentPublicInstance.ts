import { hasOwn } from "../shared/index";

const publicPropertiesMap = {
  $el: i => i.$el,
  $data: i => i.$data,
  $props: i => i.$props,
  $slots: i => i.$slots,
}

export const PublicInstanceProxyHandlers = {

  get({ _: instance }, key) {
    const { setupState, props } = instance

    if (key in setupState) {
      return setupState[key]
    }
    else if (hasOwn(setupState, key)) {
      return setupState[key]
    }
    else if (hasOwn(props, key)) {
      return props[key]
    }
    else if (hasOwn(publicPropertiesMap, key)) {
      return publicPropertiesMap[key](instance)
    }
  }

}