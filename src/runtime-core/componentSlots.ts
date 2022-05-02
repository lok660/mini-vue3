import { ShapeFlags } from '../shared/shapeFlags'

export function initSlots(instance, children) {
  const { vnode } = instance
  if (vnode & ShapeFlags.SLOT_CHILDREN) {
    normalizeObjectSlots(children, instance.slots)
  }
}

function normalizeObjectSlots(children, slots) {
  for (const key in children) {
    const value = children[key]
    if (value) {
      slots[key] = props => normalizeSlotValue(value(props))
    }
  }
}

function normalizeSlotValue(value) {
  if (Array.isArray(value)) {
    return value
  }
  return [value]
}