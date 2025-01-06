import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    PagedResults,
    SearchRequest,
    Request,
    Response,
    SourceInfo,
    SourceManga,
    BadgeColor,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding,
    SourceIntents,
    TagSection,
} from '@paperback/types'

import { Parser } from './WeebCentralParser'

const BASE_DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '1.0.0',
    name: 'WeebCentral',
    description: 'Extension that pulls manga from WeebCentral.',
    author: 'Gabe',
    authorWebsite: 'http://github.com/GabrielCWT',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: BASE_DOMAIN,
    sourceTags: [
        {
            text: 'English',
            type: BadgeColor.GREY,
        },
    ],
    intents:
        SourceIntents.MANGA_CHAPTERS |
        SourceIntents.HOMEPAGE_SECTIONS |
        SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral
    implements
        SearchResultsProviding,
        MangaProviding,
        ChapterProviding,
        HomePageSectionsProviding
{
    baseUrl = BASE_DOMAIN
    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'user-agent':
                            await this.requestManager.getDefaultUserAgent(),
                        referer: `${this.baseUrl}/`,
                    },
                }
                return request
            },
            interceptResponse: async (
                response: Response
            ): Promise<Response> => {
                return response
            },
        },
    })

    constructor(public cheerio: cheerio.CheerioAPI) {}

    RETRY = 5
    parser = new Parser()
    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        if (response.status === 404) {
            throw new Error(`Manga with id ${mangaId} not found!`)
        }
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(
        mangaId: string,
        chapterId: string
    ): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?reading_style=long_strip`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchTags(): Promise<TagSection[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/search`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        return this.parser.parseTags($)
    }

    async getSearchResults(
        query: SearchRequest,
        metadata: any
    ): Promise<PagedResults> {
        const LIMIT = 32
        const offset = metadata?.offset ?? 0
        let searchParams = ''
        // Regular search
        if (query.title) {
            searchParams = searchParams.concat(
                encodeURI(`&text=${query.title ?? ''}`)
            )
        }
        // Tag search
        else {
            for (const tag of query.includedTags) {
                searchParams = searchParams.concat(`&included_tag=${tag.id}`)
            }
            searchParams.concat(`limit=${LIMIT}&offset=${offset}`)
        }
        const request = App.createRequest({
            url: `${this.baseUrl}/search/data?sort=Best%20Match&order=Ascending&display_mode=Full%20Display${searchParams}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        const results = await this.parser.parseSearchResults($)
        metadata = this.parser.isLastPage($)
            ? undefined
            : { offset: offset + LIMIT }
        return App.createPagedResults({
            results,
            metadata,
        })
    }

    async getHomePageSections(
        sectionCallback: (section: HomeSection) => void
    ): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data as string)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(
        homepageSectionId: string,
        metadata: any
    ): Promise<PagedResults> {
        const page: number = metadata?.page ?? 1
        let param = ''
        switch (homepageSectionId) {
            case 'recent':
                param = `latest-updates/${page}`
                break
            default:
                throw new Error('Section id not supported')
        }
        const request = App.createRequest({
            url: `${this.baseUrl}/${param}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRY)
        const $ = this.cheerio.load(response.data as string)
        const manga = this.parser.parseViewMore($)
        return App.createPagedResults({
            results: manga,
            metadata: { ...metadata, page: page + 1 },
        })
    }
    /**
     * Parses a time string from a Madara source into a Date object.
     * Copied from Madara.ts made by gamefuzzy
     */
    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed
        if (
            timeAgo.includes('mins') ||
            timeAgo.includes('minutes') ||
            timeAgo.includes('minute')
        ) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        return time
    }
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'user-agent': await this.requestManager.getDefaultUserAgent(),
                referer: `${this.baseUrl}/`,
                origin: `${this.baseUrl}/`,
            },
        })
    }
    checkResponseError(response: Response): void {
        const status = response.status
        switch (status) {
            case 403:
            case 503:
                throw new Error(
                    `CLOUDFLARE BYPASS ERROR:\nPlease go to the homepage of <${this.baseUrl}> and press the cloud icon.`
                )
            case 404:
                throw new Error(
                    `The requested page ${response.request.url} was not found!`
                )
        }
    }
}
