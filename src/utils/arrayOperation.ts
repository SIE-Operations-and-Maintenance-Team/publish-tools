/**
 * 判断两数组字符串是否相同（用于按钮权限验证），数组字符串中存在相同时会自动去重（按钮权限标识不会重复）
 * @param news 新数据
 * @param old 源数据
 * @returns 两数组相同返回 `true`，反之则反
 */
export function judementSameArr(newArr: unknown[] | string[], oldArr: string[]): boolean {
	const news = removeDuplicate(newArr);
	const olds = removeDuplicate(oldArr);
	let count = 0;
	const leng = news.length;
	for (let i in olds) {
		for (let j in news) {
			if (olds[i] === news[j]) count++;
		}
	}
	return count === leng ? true : false;
}

/**
 * 判断两个对象是否相同
 * @param a 要比较的对象一
 * @param b 要比较的对象二
 * @returns 相同返回 true，反之则反
 */
export function isObjectValueEqual<T>(a: T, b: T): boolean {
	if (!a || !b) return false;
	let aProps = Object.getOwnPropertyNames(a);
	let bProps = Object.getOwnPropertyNames(b);
	if (aProps.length != bProps.length) return false;
	for (let i = 0; i < aProps.length; i++) {
		let propName = aProps[i];
		let objA = a as any;
		let objB = b as any;
		let propA = objA[propName];
		let propB = objB[propName];
		if (!b.hasOwnProperty(propName)) return false;
		if (propA instanceof Object) {
			if (!isObjectValueEqual(propA, propB)) return false;
		} else if (propA !== propB) {
			return false;
		}
	}
	return true;
}

/**
 * @param arr 数组内容
 * @param attr 需要去重的键值(数组对象)
 * @returns 去重后的数组
 */
export function removeDuplicate(arr: EmptyArrayType, attr?: string): EmptyArrayType {
    if (!Array.isArray(arr) || !arr.length) {
        return arr;
    } else {
        if (typeof attr === 'string') {
            const obj: { [key: string]: boolean } = {};
            return arr.reduce((cur: EmptyArrayType, item: EmptyObjectType) => {
                if (item.hasOwnProperty(attr)) {
                    const key = item[attr];
                    if (!obj[key]) {
                        obj[key] = true;
                        cur.push(item);
                    }
                }
                return cur;
            }, []);
        } else {
            return [...new Set(arr)];
        }
    }
}