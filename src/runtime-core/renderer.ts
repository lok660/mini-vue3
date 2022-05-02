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
        break;
    }
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