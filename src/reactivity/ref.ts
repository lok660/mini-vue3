import { isObject, hasChanged } from '../shared'
import { reactive } from './reactive'
import { trackEffects, triggerEffects, isTracking } from './effect'

class RefImpl {
  public dep;  //  ref收集的依赖容器,
  private _value: any;  //  ref的值, 可以通过ref.value获取
  private _rawValue: any; //  ref的原始值, 可以通过这个值来比较是否发生变化
  public __v_isRef = true;  //  内部标记是否为ref

  constructor(value: any) {
    this._rawValue = value;
    this._value = covert(value);
    this.dep = new Set();
  }

  get value() {
    //  收集依赖并返回值
    trackRefValue(this);
    //  实际上 ref.value 就是构造函数中的 this._value
    //  内部进行了reactive化 
    return this._value;
  }

  set value(newVal) {
    //  值发生改变才进行依赖触发
    if (hasChanged(this._rawValue, newVal)) {
      this._rawValue = newVal;
      this._value = covert(newVal);
      triggerEffects(this.dep);
    }
  }
}

//  如果当前可以收集依赖则收集跟当前ref对象有关的依赖
function trackRefValue(ref: RefImpl) {
  if (isTracking()) {
    trackEffects(ref.dep);
  }
}

//  reactive化
function covert(value: any) {
  return isObject(value) ? reactive(value) : value;
}

export function isRef(ref) {
  return !!ref.__v_isRef
}

export function unRef(ref) {
  return isRef(ref) ? ref.value : ref
}

export function ref(value) {
  return new RefImpl(value)
}

export function proxyRefs(objectWithRefs) {
  // get set
  return new Proxy(objectWithRefs, {
    get(target, key) {
      // get => age(ref) 返回value
      //  not ref => value
      return unRef(Reflect.get(target, key))
    },

    set(target, key, value) {
      //set =>ref .value
      if (isRef(target[key]) && !isRef(value)) {
        return (target[key].value = value)
      } else {
        return Reflect.set(target, key, value)
      }
    },
  })
}