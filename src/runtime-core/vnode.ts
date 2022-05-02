import { ShapeFlags } from "../shared/ShapeFlags";

//  创建vnode
//  type: 组件或者元素的类型  props: 属性  children: 子元素
export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    children,
    el: null,
    shapeFlag: getShapeFlag(type),
  };
  //  判断是否为组件
  if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  } 
  //  判断是否为element元素
  else if (typeof children === "string") {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  }
  return vnode;
}

function getShapeFlag(type: any) {
  // 判断 vnode.type 是组件还是element元素
  return typeof type === "string"
    ? ShapeFlags.ELEMENT
    : ShapeFlags.STATEFUL_COMPONENT;
}
