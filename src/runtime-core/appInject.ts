import { getCurrentInstance } from './component'

//  存储
export function provide(key, value) {
  //  getCurrentInstance必须在setup作用域下才能获取到有效的currentInstance
  const currentInstance: any = getCurrentInstance()
  if (currentInstance) {
    let { provides } = currentInstance
    const parentProvides = currentInstance.parent.provides || {}

    if (provides === parentProvides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    //  将key和value挂载到provides上
    //  privides是挂载在当前实例
    provides[key] = value
  }
}

//  获取
export function inject(key, defaultValue) {
  const currentInstance: any = getCurrentInstance()
  if (currentInstance) {
    const parentProvides = currentInstance.parent.provides || {}
    //  如果当前有provides，则直接从provides中获取
    if (key in parentProvides) {
      return parentProvides[key]
    }
    else if (defaultValue) {
      if (typeof defaultValue === 'function') {
        return defaultValue()
      }
      return defaultValue
    }
  }
}
