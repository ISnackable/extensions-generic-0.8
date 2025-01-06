import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    TagSection,
    Tag,
    HomeSectionType,
    PartialSourceManga,
} from '@paperback/types'

import entities = require('entities')

export class Parser {
    parseMangaDetails($: cheerio.Root, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim()
        const image = $('picture > img').attr('src') ?? ''
        const description = this.decodeHTMLEntity(
            $('.whitespace-pre-wrap').text().trim()
        )
        const author = $('strong:contains("Author")').text().trim()
        const parsedStatus = $('a', $('strong:contains("Status")').siblings())
            .text()
            .trim()
        let status: string
        switch (parsedStatus) {
            case 'publishing':
                status = 'Ongoing'
                break
            case 'finished':
                status = 'Completed'
                break
            case 'discontinued':
                status = 'Dropped'
                break
            case 'on hiatus':
                status = 'Hiatus'
                break
            default:
                status = 'Unknown'
        }
        const genres: Tag[] = []
        for (const genreObj of $(
            'a',
            $('strong:contains("Tags(s)")').siblings()
        ).toArray()) {
            const genre = $(genreObj).text().trim()
            const id = genre
            genres.push(App.createTag({ id, label: genre }))
        }
        const tagSections: TagSection[] = [
            App.createTagSection({
                id: '0',
                label: 'genres',
                tags: genres,
            }),
        ]
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                rating: 0,
                status,
                artist: '',
                author: author,
                tags: tagSections,
                desc: description,
            }),
        })
    }

    parseChapters($: cheerio.Root, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const arrChapters = $('a.flex.items-center').toArray()
        for (const chapterObj of arrChapters) {
            const chapterId: string =
                $(chapterObj)
                    .attr('href')
                    ?.replace(/\/$/, '')
                    ?.split('/')
                    .pop() ?? ''
            if (!chapterId) continue

            const time = new Date(
                $('time.opacity-50', chapterObj).attr('datetime') ?? ''
            )
            let chapNum = parseFloat(
                $('span.grow.flex.gap-2 span', chapterObj)
                    .first()
                    .text()
                    .trim()
                    .replace(/[^0-9.]/g, '')
            )
            chapters.push(
                App.createChapter({
                    id: chapterId,
                    name: `Chapter ${chapNum}`,
                    chapNum,
                    time,
                    langCode: 'en',
                })
            )
        }
        if (chapters.length == 0) {
            throw new Error(
                `Couldn't find any chapters for mangaId: ${mangaId}`
            )
        }
        return chapters
    }

    parseChapterDetails = (
        $: cheerio.Root,
        mangaId: string,
        chapterId: string
    ): ChapterDetails => {
        const pages: string[] = []
        for (const img of $('img', 'section.cursor-pointer').toArray()) {
            let image = $(img).attr('src') ?? ''
            if (!image) image = $(img).attr('data-src') ?? ''
            if (!image) continue
            pages.push(image)
        }

        const chapterDetails = App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
        })
        return chapterDetails
    }

    parseTags($: cheerio.Root): TagSection[] {
        const genres: Tag[] = []
        for (const genreObj of $(
            'span',
            $('fieldset.collapse-content').last()
        ).toArray()) {
            const label = $(genreObj).text().trim()
            const id = label
            genres.push(App.createTag({ id, label }))
        }
        return [
            App.createTagSection({ id: '0', label: 'genres', tags: genres }),
        ]
    }

    async parseSearchResults($: cheerio.Root): Promise<any[]> {
        const results: PartialSourceManga[] = []
        for (const item of $('article.flex.gap-4').toArray()) {
            const id =
                $('a', item)
                    .attr('href')
                    ?.split('/series/')[1]
                    ?.split('/')[0] ?? ''
            if (id == '' || typeof id != 'string')
                throw new Error('Id is empty')
            const title = $('a.link.link-hover', item).text().trim() ?? ''
            const image =
                $('img', item).attr('src') ??
                $('img', item).attr('data-src') ??
                ''
            results.push(
                App.createPartialSourceManga({
                    image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: '',
                })
            )
        }
        return results
    }

    parseHomeSections(
        $: any,
        sectionCallback: (section: HomeSection) => void
    ): void {
        const trendingSection = App.createHomeSection({
            id: 'trending',
            title: 'Trending Mangas',
            type: HomeSectionType.featured,
            containsMoreItems: false,
        })
        const recentSection = App.createHomeSection({
            id: 'recent',
            title: 'Recently Updated',
            type: HomeSectionType.singleRowNormal,
            containsMoreItems: true,
        })

        const trending: PartialSourceManga[] = []
        const recent: PartialSourceManga[] = []

        for (const trendingObj of $('glide__slide').toArray()) {
            const id = $('a', trendingObj).attr('href') ?? ''
            const title = $('.text-white', trendingObj).text().trim() ?? ''
            const image =
                $('img', trendingObj).attr('src') ??
                $('img', trendingObj).attr('data-src') ??
                ''
            trending.push(
                App.createPartialSourceManga({
                    image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: '',
                })
            )
        }
        trendingSection.items = trending
        sectionCallback(trendingSection)

        for (const recentObj of $(
            'article',
            'section.cols-span-1.rounded'
        ).toArray()) {
            const id = $('a.min-w-0', recentObj).attr('href') ?? ''
            const title = $('span', recentObj).first().text().trim() ?? ''
            const image =
                $('a img', recentObj).attr('src') ??
                $('a img', recentObj).attr('data-src') ??
                ''
            const subtitle =
                $('span.opacity-70', recentObj).first().text().trim() ?? ''
            recent.push(
                App.createPartialSourceManga({
                    image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: this.decodeHTMLEntity(subtitle),
                })
            )
        }
        recentSection.items = recent
        sectionCallback(recentSection)
    }

    parseViewMore($: cheerio.Root): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        const collectedIds: string[] = []
        for (const obj of $('article').toArray()) {
            const image: string = $('source', obj).attr('srcset') ?? ''
            const title: string = $('img', obj).attr('alt') ?? ''
            const id =
                $('a', obj)
                    .first()
                    .attr('href')
                    ?.replace(/\/$/, '')
                    ?.split('/')
                    .slice(-2)[0] ?? ''
            const getChapter = $('div.opacity-70', obj).first().text().trim()

            const chapNumRegex = getChapter.match(/(\d+\.?\d?)+/)
            let chapNum = 0
            if (chapNumRegex && chapNumRegex[1])
                chapNum = Number(chapNumRegex[1])

            const subtitle = chapNum ? 'Chapter ' + chapNum : 'Chapter N/A'

            if (!id || !title || collectedIds.includes(id)) continue
            manga.push(
                App.createPartialSourceManga({
                    image: image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: this.decodeHTMLEntity(subtitle),
                })
            )
            collectedIds.push(id)
        }

        return manga
    }

    encodeText(str: string): string {
        return str.replace(/&#([0-9]{1,4});/gi, (_, numStr) => {
            const num = parseInt(numStr, 10)
            return String.fromCharCode(num)
        })
    }

    protected decodeHTMLEntity(str: string): string {
        return entities.decodeHTML(str)
    }
}
