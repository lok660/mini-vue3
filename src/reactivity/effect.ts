import { extend } from "../shared/index";

let activeEffect
let shouldTrack
//  根据Map容器来进行键值对存储 这样可以替换下面的dep定义
let targetMap = new Map()

export class ReactiveEffect {
  private _fn: any
  public scheduler: Function | undefined
  deps = [] //  被存放的dep容器集合
  active = true //  表示是否被stop停止依赖相应
  onStop: Function | undefined
  constructor(fn, scheduler?: Function) {
    this._fn = fn
    this.scheduler = scheduler
  }

  run() {
    if (!this.active) {
      //  stop状态直接调用我们的fn并返回
      return this._fn()
    }
    shouldTrack = true
    activeEffect = this //  通过this可获取当前的effect

    const result = this._fn()
    //  调用完后重置状态
    shouldTrack = false
    activeEffect = undefined
    //  返回这个副作用函数的返回结果
    return result
  }

  stop() {
    //  停止依赖
    //  保证外部用户多次点击 cleanupEffect 函数也是只执行一次
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

function cleanupEffect(effect) {
  //  删除dep记录 促使其的第二次执行scheduler
  if (effect.deps.length) {
    effect.deps.forEach(dep => {
      dep.delete(effect)
    })
    effect.deps.length = 0
  }
}

//  当activeEffect不为undefined且shouldTrack为true时，可收集依赖
export function isTracking() {
  //  当仅仅只是单独获取响应式数据时，并不会触发effect()函数
  //  此时的activeEffect很有可能是undefined
  //  不应该track时直接return
  return shouldTrack && activeEffect !== undefined
}

export function track(target, key) {
  if (!isTracking()) return

  let depsMap = targetMap.get(target)
  //  解决初始化获取依赖不存在的问题
  if (!depsMap) {
    depsMap = new Map()
    //  如果没有则创建一个set集合作为容器并添加到depsMap容器里
    targetMap.set(target, depsMap)
  }

  let dep = depsMap.get(key)
  if (!dep) {
    //  如果没有则创建一个set集合作为容器并添加到depsMap容器里
    dep = new Set()
    depsMap.set(key, dep)
  }

  trackEffect(dep)
}

export function trackEffect(dep) {
  //  如果当前的effect已经在deps中存在，则不再重复添加
  if (dep.has(activeEffect)) {
    return
  }
  //  否则添加到deps中
  dep.add(activeEffect)
  //  为当前的effect添加依赖
  activeEffect.deps.push(dep)
}

export function trigger(target, key) {
  let depMap = targetMap.get(target)
  let dep = depMap.get(key)

  triggerEffect(dep)
}

export function triggerEffect(dep) {
  //  如果dep为undefined，则直接返回
  if (!dep) {
    return
  }
  //  否则遍历dep中的effect，调用其run()方法
  dep.forEach(effect => {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  })
}

export function effect(fn, options: any = {}) {
  const scheduler = options.scheduler
  //  创建一个新的effect实例
  const _effect = new ReactiveEffect(fn, scheduler)
  extend(_effect, options)
  //  当我们调用_effect的时候 立即执行一次 fn()
  _effect.run()
  //  希望在执行effect的时候通过回调返回的函数,将effect拿到的值的内容一起返回
  const runner: any = _effect.run.bind(_effect)
  //  给此runner添加effect属性并赋值当前副作用实例
  runner.effect = _effect
  //  返回run函数 可让外部使用
  return runner

}

//  stop函数用来停止副作用函数生效
export function stop(runner) {
  //  执行该实例的 stop 函数
  runner.effect.stop()
}