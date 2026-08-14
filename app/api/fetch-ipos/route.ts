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
    // 1. Use the most up-to-date mainboard IPO URL
    const targetUrl = 'https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/';

    // 2. Add realistic browser headers to bypass basic bot detection
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Cache for 1 hour so we don't spam their servers
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const ipos: ScrapedIPO[] = [];

    // 3. Target the tables flexibly
    $('table.table-bordered tbody tr, table.table tbody tr').each((_, element) => {
      const tds = $(element).find('td');

      // Ensure the row has enough columns to be a valid data row
      if (tds.length >= 5) {
        const name = $(tds[0]).text().trim();
        const openDate = $(tds[1]).text().trim() || $(tds[2]).text().trim();
        const closeDate = $(tds[2]).text().trim() || $(tds[3]).text().trim();
        const issuePriceRaw = $(tds[4]).text().trim() || $(tds[3]).text().trim();
        const lotSizeRaw = $(tds[5]).text().trim() || $(tds[4]).text().trim();

        // Filter out empty rows or table header rows that might get caught
        if (name && !name.toLowerCase().includes('company name') && name.length > 2) {
          // Extract numeric upper price band (e.g., "₹390 to ₹410" -> 410)
          const priceMatches = issuePriceRaw.match(/\d+(\.\d+)?/g);
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
            name: name.replace(/\s+/g, ' '),
            openDate: openDate || 'N/A',
            closeDate: closeDate || 'N/A',
            issuePrice: isNaN(issuePrice) ? 100 : issuePrice,
            lotSize: isNaN(lotSize) ? 1 : lotSize,
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      source: 'Chittorgarh Mainboard IPO List',
      count: ipos.length,
      ipos,
      data: ipos,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Scraping error';
    console.error('Scraping error:', errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg, ipos: [], data: [] },
      { status: 500 }
    );
  }
}
