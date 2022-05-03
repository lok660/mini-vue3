import { createRenderer } from "../runtime-core"

function createElement(type) {
  return document.createElement(type)
}

function patchProp(el, key, prevValue, nextValue) {
  //  onClick onChange 
  const isOn = (key: string) => /^on[A-Z]/.test(key)
  if (isOn(key)) {
    const event = key.slice(2).toLowerCase()  //  onClick -> click
    el.addEventListener(event, nextValue)
  } else {
    if (nextValue === undefined || nextValue === null) {
      //  undefined null 的情况下,移除该属性
      el.removeAttribute(key)
    } else {
      //  其他情况下,设置该属性
      el.setAttribute(key, nextValue)
    }
  }
}

function insert(parent, child) {
  parent.appendChild(child)
}

function remove(child) {
  const parent = child.parentNode
  if (parent) {
    parent.removeChild(child)
  }
}

function setElementText(el, text) {
  el.textContent = text
}

const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
  remove,
  setElementText
})

export function createApp(...args) {
  return renderer.createApp(...args)
}

export * from '../runtime-core'