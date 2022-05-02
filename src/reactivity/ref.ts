
export function isRef(ref) {
  return !!ref.__v_isRef
}

export function unRef(ref) {
  return isRef(ref) ? ref.value : ref
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