import { ShapeFlags } from '../shared/ShapeFlags'
import { createComponentInstance } from './component'
import { Fragment, Text } from "./vnode";

export function createRenderer(options) {

  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText
  } = options

  function render(vnode, container) {
    // 调用patch 方便后续节点做遍历处理
    patch(null, vnode, container, null)
  }

  /**
   * 
   * @param prevN   旧的虚拟节点
   * @param currN   当前的虚拟节点
   * @param container   渲染容器
   * @param parentComponent   父组件
   */
  function patch(prevN, currN, container, parentComponent) {

    //  shapeFlag 标识vnode属于哪种类型
    const { type, shapeFlag } = currN

    switch (type) {
      case Fragment:
        //  如果是Fragment节点,则只渲染children
        processFragment(prevN, currN, container, parentComponent)
        break;
      case Text:
        //  如果是Text节点,则只渲染text
        processText(prevN, currN, container)
      default:
        if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          //  如果是组件,则渲染组件
          processComponent(prevN, currN, container, parentComponent)
        }
        else if (shapeFlag & ShapeFlags.ELEMENT) {
          //  如果是element节点,则渲染element
          processElement(prevN, currN, container, parentComponent)
        }
    }
  }

  function processComponent(prevN, currN, container, parentComponent) {
    if (prevN) {
      //  如果存在旧的vnode,则更新组件
      // updateComponent(prevN, currN)
    } else {
      mountComponent(currN, container, parentComponent)
    }
  }

  function mountComponent(initialVNode, container, parentComponent) {
    //  创建实例对象
    const instance = createComponentInstance(initialVNode, parentComponent)
    //  处理组件的数据状态（reactive/ref/props/slots等）处理渲染函数等
    setupComponent(instance)

  }

  function mountChildren(children, container, parentComponent) {
    //  数组里面都是vnode
    //  需要遍历下去
    children.forEach(vnode => {
      patch(null, vnode, container, parentComponent)
    })
  }

  //  fragment节点直接处理children内容
  function processFragment(prevN, currN, container, parentComponent) {
    mountChildren(currN.children, container, parentComponent)
  }

  //  如果是Text节点,则生成text节点到dom容器
  function processText(prevN, currN, container) {
    const { children } = currN
    const textNode = (currN.el = document.createTextNode(children))
    container.append(textNode)
  }
}