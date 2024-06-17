import { PartialSourceManga, HomeSection } from '@paperback/types'

import { BuddyComplexParser } from '../BuddyComplexParser'

export interface UpdatedManga {
  ids: string[]
}

export class ToonilyMeParser extends BuddyComplexParser {
  override parseHomeSections(
    $: CheerioStatic,
    sections: HomeSection[],
    sectionCallback: (section: HomeSection) => void,
    languages: string[] = ['English', 'Japanese']
  ): void {
    for (const section of sections) {
      // Hot Updates
      if (section.id == 'hot_updates') {
        const HotUpdates: PartialSourceManga[] = []
        for (const manga of $(
          'div.trending-item',
          'div.main-carousel'
        ).toArray()) {
          const id = this.idCleaner($('a', manga).attr('href') ?? '')
          if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
          const title = $('a', manga).attr('title')
          const image = this.getImageSrc($('img', manga))
          const subtitle = $('span.latest-chapter', manga).text().trim()

          if (!id || !title) continue
          HotUpdates.push(
            App.createPartialSourceManga({
              mangaId: id,
              image: image,
              title: this.decodeHTMLEntity(title),
              subtitle: this.decodeHTMLEntity(subtitle)
            })
          )
        }
        section.items = HotUpdates
        sectionCallback(section)
      }

      // Latest Update
      if (section.id == 'latest_update') {
        const latestUpdate: PartialSourceManga[] = []

        for (const manga of $(
          'div.book-item.latest-item',
          'div.section.box.grid-items'
        ).toArray()) {
          const id = this.idCleaner($('a', manga).attr('href') ?? '')
          if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
          const title = $('div.title > h3 > a', manga).text().trim()
          const image = this.getImageSrc($('img', manga))
          const subtitle = $('a', $('div.chap-item', manga).first())
            .text()
            .trim()

          if (!id || !title) continue
          latestUpdate.push(
            App.createPartialSourceManga({
              mangaId: id,
              image: image,
              title: this.decodeHTMLEntity(title),
              subtitle: this.decodeHTMLEntity(subtitle)
            })
          )
        }
        section.items = latestUpdate
        sectionCallback(section)
      }

      // Top Today
      if (section.id == 'top_today') {
        const TopTodayManga: PartialSourceManga[] = []
        for (const manga of $(
          'div.top-item',
          $('div.tab-panel').get(0)
        ).toArray()) {
          const id = this.idCleaner($('a', manga).attr('href') ?? '')
          if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
          const title = $('h3.title', manga).text().trim()
          const image = this.getImageSrc($('img', manga))
          const subtitle = $('h4.chap-item', manga).text().trim()

          if (!id || !title) continue
          TopTodayManga.push(
            App.createPartialSourceManga({
              mangaId: id,
              image: image,
              title: this.decodeHTMLEntity(title),
              subtitle: this.decodeHTMLEntity(subtitle)
            })
          )
        }
        section.items = TopTodayManga
        sectionCallback(section)
      }

      // Top Weekly
      if (section.id == 'top_weekly') {
        const TopWeeklyManga: PartialSourceManga[] = []
        for (const manga of $(
          'div.top-item',
          $('div.tab-panel').get(1)
        ).toArray()) {
          const id = this.idCleaner($('a', manga).attr('href') ?? '')
          if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
          const title = $('h3.title', manga).text().trim()
          const image = this.getImageSrc($('img', manga))
          const subtitle = $('h4.chap-item', manga).text().trim()

          if (!id || !title) continue
          TopWeeklyManga.push(
            App.createPartialSourceManga({
              mangaId: id,
              image: image,
              title: this.decodeHTMLEntity(title),
              subtitle: this.decodeHTMLEntity(subtitle)
            })
          )
        }
        section.items = TopWeeklyManga
        sectionCallback(section)
      }

      // Top Monthly
      if (section.id == 'top_monthly') {
        const TopMonthlyManga: PartialSourceManga[] = []
        for (const manga of $(
          'div.top-item',
          $('div.tab-panel').get(2)
        ).toArray()) {
          const id = this.idCleaner($('a', manga).attr('href') ?? '')
          if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
          const title = $('h3.title', manga).text().trim()
          const image = this.getImageSrc($('img', manga))
          const subtitle = $('h4.chap-item', manga).text().trim()

          if (!id || !title) continue
          TopMonthlyManga.push(
            App.createPartialSourceManga({
              mangaId: id,
              image: image,
              title: this.decodeHTMLEntity(title),
              subtitle: this.decodeHTMLEntity(subtitle)
            })
          )
        }
        section.items = TopMonthlyManga
        sectionCallback(section)
      }
    }
  }

  override parseViewMore = (
    $: CheerioStatic,
    languages: string[] = ['English', 'Japanese']
  ): PartialSourceManga[] => {
    const mangas: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const manga of $('div.book-item', 'div.list').toArray()) {
      const id = this.idCleaner($('a', manga).attr('href') ?? '')
      if (!languages.includes('Japanese') && id.endsWith('-raw')) continue
      const title = $('div.title', manga).text().trim()
      const image = this.getImageSrc($('img', manga))
      const subtitle = $('span.latest-chapter', manga).text().trim()

      if (!id || !title || collectedIds.includes(id)) continue
      mangas.push(
        App.createPartialSourceManga({
          mangaId: id,
          image: image,
          title: this.decodeHTMLEntity(title),
          subtitle: this.decodeHTMLEntity(subtitle)
        })
      )
      collectedIds.push(id)
    }
    return mangas
  }
}
