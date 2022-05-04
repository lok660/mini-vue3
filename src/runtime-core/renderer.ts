import { createAppAPI } from './createApp';
import { effect } from "../reactivity/effect";
import { ShapeFlags } from '../shared/shapeFlags'
import { createComponentInstance, setupComponent } from './component'
import { Fragment, Text } from "./vnode";
import { shouldUpdateComponent } from './componentUpdateUtils'
import { queueJobs } from './scheduler'

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
    patch(null, vnode, container, null, null)
  }

  /**
   * 
   * @param n1   旧的虚拟节点
   * @param n2   当前的虚拟节点
   * @param container   渲染容器
   * @param parentComponent   父组件
   */
  function patch(
    n1,
    n2,
    container,
    parentComponent,
    anchor,
  ) {
    //  shapeFlag 标识vnode属于哪种类型
    const { type, shapeFlag } = n2

    switch (type) {
      case Fragment:
        //  如果是Fragment节点,则只渲染children
        processFragment(n1, n2, container, parentComponent, anchor)
        break;

      case Text:
        //  如果是Text节点,则只渲染text
        processText(n1, n2, container)
        break;

      default:
        if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          //  如果是组件,则渲染组件
          processComponent(n1, n2, container, parentComponent, anchor)
        }
        else if (shapeFlag & ShapeFlags.ELEMENT) {
          //  如果是element节点,则渲染element
          processElement(n1, n2, container, parentComponent, anchor)
        }
        break;
    }

  }

  function processElement(
    n1,
    n2,
    container,
    parentComponent,
    anchor
  ) {
    //  判断是否是新增节点
    if (!n1) {
      //  如果是新增节点,则创建element
      mountElement(n2, container, parentComponent, anchor)
    }
    else {
      //  如果是旧节点,则更新element
      patchElement(n1, n2, container, parentComponent, anchor)
    }
  }

  function patchElement(
    n1,
    n2,
    container,
    parentComponent,
    anchor
  ) {
    const oldProps = n1.props || {}
    const newProps = n2.props || {}
    //  新的节点没有el
    const el = (n2.el = n1.el)

    patchChildren(n1, n2, el, parentComponent, anchor)
    patchProps(el, oldProps, newProps)
  }

  function patchProps(el, oldProps, newProps) {
    //  判断是否有新增属性
    for (const key in newProps) {
      const prevProp = oldProps[key]
      const nextProp = newProps[key]

      if (prevProp !== nextProp) {
        hostPatchProp(el, key, prevProp, nextProp)
      }
    }
    if (newProps !== {}) {
      //  如果有删除属性,则调用hostPatchProp方法
      for (const key in oldProps) {
        if (!(key in newProps)) {
          hostPatchProp(el, key, oldProps[key], null)
        }
      }
    }
  }

  function patchChildren(n1, n2, container, parentComponent, anchor) {
    const { children: prevChildren, shapeFlag: prevShapeFlag } = n1
    const { children: nextChildren, shapeFlag: nextShapeFlag } = n2

    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(prevChildren) //  如果是旧节点,则销毁旧节点的子节点
      }
      if (prevChildren !== nextChildren) {
        hostSetElementText(container, nextChildren)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '')
        mountChildren(nextChildren, container, parentComponent, anchor)
      } else {
        patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, anchor)
      }
    }
  }

  function patchKeyedChildren( //  对keyed children进行更新
    c1,
    c2,
    container,
    parentComponent,
    parentAnchor
  ) {
    const l2 = c2.length
    let i = 0 //  新旧节点指向同步的指针
    let e1 = c1.length - 1  //  变更前节点的尾下标
    let e2 = l2 - 1 //  变更后节点的尾下标

    //  判断更新前后两个节点类型和Key是否一致
    function isSomeVNodeType(n1, n2) {
      return n1.type === n2.type && n1.key === n2.key
    }

    //  左侧对比
    //  从左往右依次查找,如果节点可以复用,则继续往右,不能就停止循环
    while (i <= e1 && i <= e2) {
      //  取出新老节点
      const n1 = c1[i]
      const n2 = c2[i]
      //  是否一样
      if (isSomeVNodeType(n1, n2)) {
        //  递归调用
        patch(n1, n2, container, parentComponent, parentAnchor)
      } else {
        //  停止循环
        break
      }
      //  指针往右移动
      i++
    }

    //  右侧对比
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSomeVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor)
      } else {

        break
      }
      e1--
      e2--
    }

    //  经过前两步的处理，新旧队列已经进一步缩短了,相同部分已经处理完毕

    //  故剩下的节点就可能存在三种情况
    //  1.有新增的节点
    //  2.有节点被删除了
    //  3.相同的节点，但是移动了位置

    //  实际场景中,那么只有存在下面三种情况
    //  仅有新增的节点(此时一定i > e1)
    //  仅进行了节点删除(此时一定i > e2)
    //  乱序的，一定有移动的节点，其中可能包含新增或有删除的节点(此时一定有i <= e2且i <= e1)

    //  新的比老的多,需要进行创建,i > e1 && i <= e2
    if (i > e1) {
      if (i <= e2) {
        //  当前节点后面的节点
        const nextPos = e2 + 1
        //  以这个节点为锚点在其之前添加元素，没有则添加到父节点最后
        const anchor = nextPos < l2 ? c2[nextPos].el : null
        while (i <= e2) {
          patch(null, c2[i], container, parentComponent, anchor)
          i++
        }
      }
    } else if (i > e2) {
      //  老的比新的多,需要进行删除
      while (i <= e1) {
        hostRemove(c1[i].el)
        i++
      }
    } else {
      //  中间乱序的情况
      let s1 = i //  新节点的指针
      let s2 = i //  老节点的指针

      const toBePatched = e2 - s2 + 1 //  需要patch的节点数
      let patched = 0 //  已经patch的节点数
      const keyToNewIndexMap = new Map() //  新节点的key到新节点的指针的映射
      const newIndexToOldIndexMap = new Array(toBePatched) //  新节点的指针到老节点的指针的映射
      let moved = false //  是否有节点被移动了位置
      let maxNewIndexSoFar = 0 //  记录节点是否已经移动

      for (let i = 0; i < toBePatched; i++) {
        newIndexToOldIndexMap[i] = 0
      }
      for (let i = s2; i <= e2; i++) {
        const nextChild = c2[i]
        keyToNewIndexMap.set(nextChild.key, i)
      }
      for (let i = s1; i <= e1; i++) {
        const prevChild = c1[i]

        if (patched >= toBePatched) {
          hostRemove(prevChild.el)
          continue
        }
        // 有key直接找映射表
        let newIndex
        if (prevChild.key !== null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {  // 没有key继续遍历
          for (let j = s2; j <= e2; j++) {
            // 借助已经封装好的方法
            if (isSomeVNodeType(prevChild, c2[j])) {
              newIndex = j

              break
            }
          }
        }
        //    新值中没有老值,进行删除
        if (newIndex === undefined) {
          hostRemove(prevChild.el)
        } else {
          // 新值大于记录的值 重置最大的值
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            // 新值小于记录的值说明进行位置的移动
            moved = true
          }

          // 证明新节点是存在的  在此处将老节点进行遍历对新节点进行重新赋值
          // 因为此处我们的索引计算包含了前面的部分所以需要减去前面的部分也就是s2
          // 由于新节点可能在老节点中是不存在的 所以需要考虑到为0的情况 可以将我们的i加1处理
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          //    存在继续进行深度对比
          patch(prevChild, c2[newIndex], container, parentComponent, null)
          patched++
        }

      }
      // 给最长递增子序列算法准备进行处理的数组
      const increasingNewIndexSequence: any = moved ? getSequence(newIndexToOldIndexMap) : [] // 需要进行位置的移动时才调用算法,减少不必要的逻辑代码
      let j = increasingNewIndexSequence.length - 1
      // 获取到我们的最长递增子序列这是一个数组,需要将我们的老值进行遍历 然后
      // 利用两个指针分别指向我们的最长递增子序列和我们的老值 如果老值没有匹配 则说明需要进行位置移动
      // toBePatched就是我们的新值的中间乱序的长度
      for (let i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = i + s2
        const nextChild = c2[nextIndex]
        const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null
        if (newIndexToOldIndexMap[i] === 0) {
          // 在旧值中找不到新值的映射时就需要新创建
          patch(null, nextChild, container, parentComponent, anchor)
        } else if (moved) { // 需要移动时才进入相关的逻辑判断
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            console.log('需要进行位置移动')
            hostInsert(nextChild.el, container, anchor)
          } else {
            // 不需要进行移动的话 将j的指针右移
            j--
          }
        }
      }

    }

  }


  function unmountChildren(children) {
    children.forEach(child => {
      hostRemove(child.el)
    })
  }

  function mountElement(vnode, container, parentComponent, anchor) {
    //  创建element
    const { children, shapeFlag, props, type } = vnode
    const el = vnode.el = hostCreateElement(type)
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      //  如果是数组,说明传入的是vnode,则遍历渲染
      mountChildren(children, el, parentComponent, anchor)
    }
    else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      //  如果是文本,则设置文本
      hostSetElementText(el, children)
    }
    //  如果有props,则设置props
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    hostInsert(el, container, anchor)

  }

  function processComponent(n1, n2, container, parentComponent, anchor) {
    if (n1) {
      //  如果存在旧的vnode,则更新组件
      updateComponent(n1, n2)
    } else {
      mountComponent(n2, container, parentComponent, anchor)
    }
  }

  function updateComponent(n1, n2) {
    // 判断是否需要更新
    const instance = (n2.component = n1.component)
    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2

      instance.update()
    } else {
      // 重置虚拟节点
      n2.el = n1.el
      n2.vnode = n2
    }
  }

  function mountComponent(initialVNode, container, parentComponent, anchor) {
    //  创建实例对象
    const instance = createComponentInstance(initialVNode, parentComponent)
    //  处理组件的数据状态（reactive/ref/props/slots等）处理渲染函数等
    setupComponent(instance)
    //  渲染组件
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  function setupRenderEffect(instance, initialVNode, container, anchor) {
    effect(() => {
      if (!instance.isMounted) {
        console.log('mount')
        const { proxy } = instance
        const subTree = instance.subTree = instance.render.call(proxy)  //  将实例上的proxy代理到render函数上,,通过this.xxx调用
        //  初始化,没有旧的vnode,直接渲染组件
        patch(null, subTree, container, instance, anchor)

        initialVNode.el = subTree.el  //  将组件的虚拟dom赋值给vnode
        instance.isMounted = true // 标识组件已经渲染完成
      } else {
        console.log('update')
        const { next, vnode } = instance

        if (next) {
          next.el = vnode.el
          updateComponentPreRender(instance, next)
        }
        //  如果组件已经挂载,则更新组件
        const { proxy } = instance
        const subTree = instance.render.call(proxy)
        const prevSubTree = instance.subTree  //  旧的vnode
        instance.subTree = subTree  //  新的vnode
        //  更新组件
        patch(prevSubTree, subTree, container, instance, anchor)
      }
    },
      {
        scheduler() {
          console.log('update-scheduler')

          queueJobs(instance.update)
        },
      })
  }

  function mountChildren(children, container, parentComponent, anchor) {
    //  数组里面都是vnode
    //  需要遍历下去
    children.forEach(vnode => {
      patch(null, vnode, container, parentComponent, anchor)
    })
  }

  //  fragment节点直接处理children内容
  function processFragment(n1, n2, container, parentComponent, anchor) {
    mountChildren(n2.children, container, parentComponent, anchor)
  }

  //  如果是Text节点,则生成text节点到dom容器
  function processText(n1, n2, container) {
    const { children } = n2
    const textNode = (n2.el = document.createTextNode(children))
    container.appendChild(textNode)
  }

  return {
    createApp: createAppAPI(render),
  }
}

/**
 * @description: 更新Component的vnode
 * 将 新的 vnode 赋值给  vnode
 * 赋值后重置next节点
 * @param {*} instance
 * @param {*} nextVNode
 * @return {*}
 */
function updateComponentPreRender(instance, nextVNode) {
  instance.vnode = nextVNode
  instance.next = null
  instance.props = nextVNode.props
}

// 最长递增子序列算法
function getSequence(arr) {
  const p = arr.slice()
  const result = [0] // 存储长度为i的递增子序列的索引
  let i, j, u, v, c
  const len = arr.length
  for (let i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      // 把j赋值为数组最后一项 
      j = result[result.length - 1]
      // result存储的最后一个值小于当前值
      if (arr[j] < arrI) {
        //    存储在result更新前的最后一个索引的值
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      // 二分搜索 查找比arrI小的节点  更新result的值
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  // 回溯数组 找到最终的索引
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}