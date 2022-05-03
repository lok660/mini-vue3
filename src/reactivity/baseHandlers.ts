import { extend, isObject } from '../shared/index'
import { track, trigger } from "./effect";
import { ReactiveFlags, reactive, readonly } from './reactive'

//  因为所有proxy用到的get或set都是一样的
//  所以全局声明get和set使用，防止每创建一个响应式对象或只读对象所带来的创建get和set的内存消耗

const get = createGetter()
const set = createSetter()
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver)

    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }
    //  如果是shallowReadonly 就直接返回
    if (shallow) return res

    //  如果是对象，根据isREadony判断返回深响应还是深只读
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    //  如果不是只读对象,则收集依赖
    if (!isReadonly) {
      track(target, key)
    }

    return res
  }
}

function createSetter() {
  return function set(target, key, receiver) {
    const res = Reflect.set(target, key, receiver)
    trigger(target, key)
    return res
  }
}

export const mutableHandlers = {
  // 缓存
  get,
  set,
}

export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key, value) {
    console.warn(`key:"${String(key)}" set 失败 因为 target 是 readonly`, target)
    return true
  }
}

//  shallowReadonly的代理处理器，这里由于set和readonlyHandler相同所以用属性值覆盖优化了代码
export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet
})