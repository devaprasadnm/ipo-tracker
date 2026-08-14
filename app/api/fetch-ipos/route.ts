import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export interface ScrapedIPO {
  name: string;
  issuePrice: number;
  lotSize: number;
  openDate: string;
  closeDate: string;
}

export async function GET() {
  try {
    const targetUrl = 'https://www.chittorgarh.com/report/mainboard-ipo-list-in-india/252/';

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} fetching Chittorgarh IPO data`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const ipos: ScrapedIPO[] = [];

    // Target the table rows from Chittorgarh report table
    $('table.table-bordered tbody tr, table.table tbody tr').each((_, element) => {
      const tds = $(element).find('td');

      if (tds.length >= 5) {
        const nameRaw = $(tds[0]).text().trim();
        const openDateRaw = $(tds[1]).text().trim() || $(tds[2]).text().trim();
        const closeDateRaw = $(tds[2]).text().trim() || $(tds[3]).text().trim();
        const priceBandRaw = $(tds[4]).text().trim() || $(tds[3]).text().trim();
        const lotSizeRaw = $(tds[5]).text().trim() || $(tds[4]).text().trim();

        if (nameRaw && nameRaw.length > 2) {
          // Extract numeric upper price band (e.g., "₹390 to ₹410" -> 410)
          const priceMatches = priceBandRaw.match(/\d+(\.\d+)?/g);
          let issuePrice = 100;
          if (priceMatches && priceMatches.length > 0) {
            issuePrice = parseFloat(priceMatches[priceMatches.length - 1]);
          }

          // Extract numeric lot size (e.g., "38 Shares" -> 38)
          const lotMatches = lotSizeRaw.match(/\d+/g);
          let lotSize = 1;
          if (lotMatches && lotMatches.length > 0) {
            lotSize = parseInt(lotMatches[0], 10);
          }

          ipos.push({
            name: nameRaw.replace(/\s+/g, ' '),
            issuePrice: isNaN(issuePrice) ? 100 : issuePrice,
            lotSize: isNaN(lotSize) ? 1 : lotSize,
            openDate: openDateRaw || 'N/A',
            closeDate: closeDateRaw || 'N/A',
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      source: 'Chittorgarh IPO Tracker',
      count: ipos.length,
      ipos,
      data: ipos,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Scraping failed';
    console.error('IPO Scraper Error:', errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg, ipos: [] },
      { status: 500 }
    );
  }
}
