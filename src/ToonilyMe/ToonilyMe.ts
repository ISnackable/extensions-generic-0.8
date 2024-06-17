import {
  ContentRating,
  SourceInfo,
  BadgeColor,
  SourceIntents,
  SourceStateManager,
  DUINavigationButton,
  HomeSectionType,
  HomeSection,
  DUISection,
  PagedResults,
} from '@paperback/types'

import {
  getExportVersion,
  BuddyComplex
} from '../BuddyComplex'
import { ToonilyMeParser } from './ToonilyMeParser'

const DOMAIN = 'https://toonily.me'

export const ToonilyMeInfo: SourceInfo = {
  version: getExportVersion('0.0.1'),
  name: 'ToonilyMe',
  description: `Extension that pulls manga from ${DOMAIN}`,
  author: 'Netsky',
  authorWebsite: 'http://github.com/TheNetsky',
  icon: 'icon.png',
  contentRating: ContentRating.ADULT,
  websiteBaseURL: DOMAIN,
  sourceTags: [
    {
      text: '18+',
      type: BadgeColor.YELLOW,
    },
  ],
  intents:
    SourceIntents.MANGA_CHAPTERS |
    SourceIntents.HOMEPAGE_SECTIONS |
    SourceIntents.CLOUDFLARE_BYPASS_REQUIRED |
    SourceIntents.SETTINGS_UI,
};

export class ToonilyMe extends BuddyComplex {
  baseUrl: string = DOMAIN;
  stateManager = App.createSourceStateManager()
  override parser = new ToonilyMeParser();

  async getSourceMenu(): Promise<DUISection> {
    return App.createDUISection({
      id: 'main',
      header: 'Source Menu',
      isHidden: false,
      rows: async () => [
        this.sourceSettings(this.stateManager),
        this.resetSettings(this.stateManager)
      ]
    })
  }

  sourceSettings = (stateManager: SourceStateManager): DUINavigationButton => {
    return App.createDUINavigationButton({
      id: 'toonilyme_settings',
      label: 'Source Settings',
      form: App.createDUIForm({
        sections: async () => [
          App.createDUISection({
            id: 'content',
            isHidden: false,
            footer: 'Content settings for ToonilyMe',
            rows: async () => [
              App.createDUISelect({
                id: 'languages',
                label: 'Languages',
                options: ['English', 'Japanese'],
                labelResolver: async (option) =>
                  ['English', 'Japanese'].find(
                    (language) => language === option
                  ) ?? 'Unknown',
                value: App.createDUIBinding({
                  get: async () =>
                    (await stateManager.retrieve('languages')) ?? [
                      'English',
                      'Japanese'
                    ],
                  set: async (newValue) => {
                    await stateManager.store('languages', newValue)
                  }
                }),
                allowsMultiselect: true
              })
            ]
          })
        ]
      })
    })
  }

  resetSettings = (stateManager: SourceStateManager): DUINavigationButton => {
    return App.createDUIButton({
      id: 'reset',
      label: 'Reset to Default',
      onTap: async () => await stateManager.store('languages', null)
    })
  }

  override async getHomePageSections(
    sectionCallback: (section: HomeSection) => void
  ): Promise<void> {
    const languages: string[] = (await this.stateManager.retrieve(
      'languages'
    )) ?? ['English', 'Japanese']

    const section1 = App.createHomeSection({ id: 'hot_updates', title: 'Hot Updates', type: HomeSectionType.singleRowNormal, containsMoreItems: true })
    const section2 = App.createHomeSection({ id: 'latest_update', title: 'Latest Updates', type: HomeSectionType.singleRowNormal, containsMoreItems: true })
    const section3 = App.createHomeSection({ id: 'top_today', title: 'Top Today', type: HomeSectionType.singleRowNormal, containsMoreItems: true })
    const section4 = App.createHomeSection({ id: 'top_weekly', title: 'Top Weekly', type: HomeSectionType.singleRowNormal, containsMoreItems: true })
    const section5 = App.createHomeSection({ id: 'top_monthly', title: 'Top Monthly', type: HomeSectionType.singleRowNormal, containsMoreItems: true })

    const sections: HomeSection[] = [section1, section2, section3, section4, section5]

    const request = App.createRequest({
        url: `${this.baseUrl}/`,
        method: 'GET'
    })

    const response = await this.requestManager.schedule(request, 1)
    this.CloudFlareError(response.status)
    const $ = this.cheerio.load(response.data as string)
    this.parser.parseHomeSections($, sections, sectionCallback, languages)
  }

  override async getViewMoreItems(
    homepageSectionId: string,
    metadata: any
  ): Promise<PagedResults> {
    const languages: string[] = (await this.stateManager.retrieve(
      'languages'
    )) ?? ['English', 'Japanese']

    const page: number = metadata?.page ?? 1
    let param = ''
    switch (homepageSectionId) {
      case 'hot_updates':
        param = 'popular'
        break
      case 'latest_update':
        param = 'latest'
        break
      case 'top_today':
        param = 'top/day'
        break
      case 'top_weekly':
        param = 'top/week'
        break
      case 'top_monthly':
        param = 'top/month'
        break
      default:
        throw new Error(`Invalid homeSectionId | ${homepageSectionId}`)
    }

    const request = App.createRequest({
      url: `${this.baseUrl}/${param}?page=${page}`,
      method: 'GET'
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data as string)

    const manga = this.parser.parseViewMore($, languages)

    metadata = !this.parser.isLastPage($) ? { page: page + 1 } : undefined
    return App.createPagedResults({
      results: manga,
      metadata
    })
  }
}
