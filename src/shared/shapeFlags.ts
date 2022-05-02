export const enum ShapeFlags {
  // 利用位运算进行查和改
  ELEMENT = 1,  // 0001
  STATEFUL_COMPONENT = 1 << 1,  // 0010
  TEXT_CHILDREN = 1 << 2, // 0100
  ARRAY_CHILDREN = 1 << 3, // 1000
  SLOT_CHILDREN = 1 << 4  //  10000
}

// 修改就使用我们的或| 查找就使用我们的与&
// 二进制情况下  0100 | 0000 = 0100
// 二进制情况下  0100 & 0011 = 0000
// 通过这个来 设置vnode 的shapeflag 通过获取shapeflag