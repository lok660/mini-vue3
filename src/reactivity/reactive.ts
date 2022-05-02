import { isObject } from './../shared/index'
import { shallowReadonlyHandlers } from './baseHandlers'

export const enum ReactiveFlags {
  IS_REACTIVE = "__V_isReactive",
  IS_READONLY = "__V_isReadonly",
}

export function shallowReadonly(raw) {
  return createReactiveObject(raw, shallowReadonlyHandlers)
}

function createReactiveObject(target, baseHandlers) {
  if (!isObject(target)) {
    console.warn('target ${target} 必须是一个对象')
  }
  return new Proxy(target, baseHandlers)
}