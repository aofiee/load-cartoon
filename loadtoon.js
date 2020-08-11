const puppeteer = require('puppeteer')
const mkdirp = require('mkdirp')
const https = require('https')
const fs = require('fs')
const url = require('url')
const path = require('path')
let browser
let page
const target = 'https://www.mangathai.com/manga-private-hero/'

const run = async () => {
    mkdirp('./download').then(made =>
        console.log(`made directories, starting with ${made}`))
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-infobars'],
        devtools: true,
    })
    const options = { waitUntil: 'load', timeout: 0, visible: true }
    page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 768 })
    await page.goto(target, { waitUntil: 'networkidle0' })
    const title = await page.title()
    console.log(`connect to site... ${title}`)
    const resultSelector = 'body > div.container'
    await page.waitForSelector(resultSelector, options)
    const findingElement = '.chapter-name'
    const result = await page.evaluate((resultSelector, findingElement) => [...document.querySelectorAll(findingElement)].map(elem => {
        const data = {
            title: elem.querySelector(`${findingElement} > a`).textContent,
            link: elem.querySelector(`${findingElement} > a`).getAttribute('href')
        }
        return data
    })
        , resultSelector, findingElement
    )
    const ep = result.reverse()
    console.log(ep)
    let index = 0
    for (const item of ep) {
        await loadEP(page, item, index)
        index++
    }
}
const loadEP = async (page, item, index) => {
    mkdirp(`./download/${index + 1}`).then(made =>
        console.log(`made directories, starting with ${made}`))
    let pageURL = item.link
    console.log(`load ${item.link} = ${index}`)
    do {
        const options = { waitUntil: 'load', timeout: 0 }
        await page.goto(pageURL, { waitUntil: 'networkidle0' })
        const coverSelector = '.img-manga'
        await page.waitForSelector(coverSelector, options)
        const imgURL = await page.evaluate(coverSelector => {
            const img = document.querySelector(coverSelector).getAttribute('src')
            return img
        }, coverSelector)
        const imageURL = imgURL.replace("http://", "https://")

        console.log(`Downloading... ${imageURL}`)
        const parsed = url.parse(imageURL)
        const filename = path.basename(parsed.pathname)
        await download(imageURL, `./download/${index + 1}/${filename}`)
        const btn = '.btn_next_page'
        pageURL = await page.evaluate(btn => {
            const next = document.querySelector(btn).getAttribute('href')
            return next + '/'
        }, btn)
    } while (page.url() !== pageURL)
    console.log(`Download Finished.`)
}
const download = async (imageURL, savePath) => {
    await new Promise((resolve, reject) => {
        const createFile = fs.createWriteStream(savePath)
        https.get(imageURL, (res) => {
            res.pipe(createFile)
            createFile.on('finish', () => {
                console.log(`Download ${savePath} is finished.`)
                createFile.close()
                resolve()
            })
            createFile.on('error', (error) => {
                reject(error)
            })
        })
    })

}
run()