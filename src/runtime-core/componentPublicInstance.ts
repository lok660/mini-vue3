import { hasOwn } from "../shared/index";

const publicPropertiesMap = {
  $el: i => i.$el,
  $data: i => i.$data,
  $props: i => i.$props,
  $slots: i => i.$slots,
}

//  处理组件代理对象获取setup返回的数据对象以及$el属性值
//  此处的代理data,props是通过proxy代理的,与vue2不同
export const PublicInstanceProxyHandlers = {

  get({ _: instance }, key) {
    const { setupState, props } = instance
    //  如果是setupState中的属性，则返回setupState中的属性
    if (hasOwn(setupState, key)) {
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