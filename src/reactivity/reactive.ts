import { isArray, isObject } from './../shared/index'
import { shallowReadonlyHandlers, mutableHandlers, readonlyHandlers } from './baseHandlers'

export const enum ReactiveFlags {
  IS_REACTIVE = "__V_isReactive",
  IS_READONLY = "__V_isReadonly",
}

//  做一个深度的reactive化
export function reactive(target) {
  return createReactiveObject(target, mutableHandlers)
}

//  做一个只读的reactive化
export function readonly(target) {
  return createReactiveObject(target, readonlyHandlers)
}

//  做一个shallowReadonly的reactive化
export function shallowReadonly(target) {
  return createReactiveObject(target, shallowReadonlyHandlers)
}

export function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value.value)
  }
  return !!(value && value[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value) {
  return !!(value && value[ReactiveFlags.IS_READONLY])
}

export function isProxy(value) {
  return isReactive(value) || isReadonly(value)
}

function createReactiveObject(target, baseHandlers) {
  if (!isObject(target)) {
    console.warn('target ${target} 必须是一个对象')
  }
  return new Proxy(target, baseHandlers)
}