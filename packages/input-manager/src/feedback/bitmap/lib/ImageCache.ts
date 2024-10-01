import { LRUCache } from 'lru-cache'
import { Image } from 'skia-canvas'

const MAX_CACHE_ITEMS = 1000

class ImageCache {
	cache: LRUCache<string, Image>

	constructor() {
		this.cache = new LRUCache<string, Image>({
			max: MAX_CACHE_ITEMS,
		})
	}

	get(src: string): Image {
		const cachedImage = this.cache.get(src)
		if (cachedImage) return cachedImage

		const newImage = new Image()
		newImage.src = src
		this.cache.set(src, newImage)
		return newImage
	}
}

export const GlobalImageCache = new ImageCache()
