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
        const title = this.decodeHTMLEntity($('h1').text().trim())
        const image = $('.lazy').attr('data-src') ?? ''
        const description = this.decodeHTMLEntity(
            $('.text-sm.text--secondary').text().trim()
        )
        const parsedStatus = $('label:contains("Status")')
            .siblings()
            .first()
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
        for (const genreObj of $('label:contains("Genres")')
            .siblings()
            .toArray()) {
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
                author: '',
                tags: tagSections,
                desc: description,
            }),
        })
    }

    parseChapters($: cheerio.Root, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        const arrChapters = $('#chapters a').toArray()
        let backupChapNum = 0
        for (const chapterObj of arrChapters) {
            const id =
                $(chapterObj).attr('href') ?? ''

            const time = undefined
            const name = $(chapterObj).text().trim()
            let chapNum = parseFloat($(chapterObj).text().trim().replace(/[^0-9.]/g, ''))
            if (chapNum) backupChapNum = chapNum
            else chapNum = ++backupChapNum
            chapters.push(
                App.createChapter({
                    id,
                    name,
                    chapNum,
                    time,
                    langCode: 'en',
                })
            )
        }
        return chapters
    }

    parseChapterDetails(
        $: cheerio.Root,
        mangaId: string,
        id: string
    ): ChapterDetails {
        const pages: string[] = []
        for (const pageObj of $('picture > img').get()) {
            const page =
                $(pageObj).attr('data-src') ?? $(pageObj).attr('src') ?? ''
            pages.push(encodeURI(page))
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseTags($: cheerio.Root): TagSection[] {
        const genres: Tag[] = []
        for (const genreObj of $('.grid.gap-1 div').toArray()) {
            const label = $(genreObj).text().trim()
            const id = $('input', genreObj).attr('value') ?? label
            genres.push(App.createTag({ id, label }))
        }
        return [
            App.createTagSection({ id: '0', label: 'genres', tags: genres }),
        ]
    }

    async parseSearchResults($: cheerio.Root): Promise<any[]> {
        const results: PartialSourceManga[] = []
        for (const item of $('.my-3.grid > div').toArray()) {
            const id =
                ($('a', item).attr('href') ?? '')
            if (id == '' || typeof id != 'string') throw new Error('Id is empty')
            const title = $('div a', item).text().trim() ?? ''
            const image =
                $('a img', item).attr('src') ??
                $('a img', item).attr('data-src') ??
                ''
            const subtitle = $('.text-secondary', item).text().trim() ?? ''
            results.push(
                App.createPartialSourceManga({
                    image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: this.decodeHTMLEntity(subtitle),
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
            id: '0',
            title: 'Trending Mangas',
            type: HomeSectionType.featured,
            containsMoreItems: false,
        })
        const recentSection = App.createHomeSection({
            id: '1',
            title: 'Recently Updated',
            type: HomeSectionType.singleRowNormal,
            containsMoreItems: false,
        })

        const trending: PartialSourceManga[] = []
        const recent: PartialSourceManga[] = []

        for (const trendingObj of $('> div', $('.grid-cols-2').last()).toArray()) {
            const id = $('a.text-secondary', trendingObj).attr('href') ?? ''
            const title =
                $('div a > div', trendingObj).first().text().trim() ?? ''
            const image =
                $('a img', trendingObj).attr('src') ??
                $('a img', trendingObj).attr('data-src') ??
                ''
            const subtitle =
            $('.text-secondary', trendingObj).text().trim() ?? ''
            trending.push(
                App.createPartialSourceManga({
                    image,
                    title: this.decodeHTMLEntity(title),
                    mangaId: id,
                    subtitle: this.decodeHTMLEntity(subtitle),
                })
            )
        }
        trendingSection.items = trending
        sectionCallback(trendingSection)

        for (const recentObj of $('> div', $('.grid-cols-2').first()).toArray()) {
            const id = $('a.text-secondary', recentObj).attr('href') ?? ''
            const title =
                $('div a > div', recentObj).first().text().trim() ?? ''
            const image =
                $('a img', recentObj).attr('src') ??
                $('a img', recentObj).attr('data-src') ??
                ''
            const subtitle =
                $('.text-secondary', recentObj).text().trim() ?? ''
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
