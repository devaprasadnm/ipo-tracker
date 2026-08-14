import { NextResponse } from 'next/server';

export interface ScrapedIPO {
  name: string;
  issuePrice: number;
  lotSize: number;
  openDate: string;
  closeDate: string;
  symbol?: string;
}

export async function GET() {
  try {
    const rapidApiKey = 'fe41e305camsh2f8ef2f20e117e7p1fc751jsndfb091ef8899';
    const rapidApiHost = 'indian-ipos1.p.rapidapi.com';

    // Dedicated RapidAPI Indian IPOs API
    const response = await fetch('https://indian-ipos1.p.rapidapi.com/closed-ipos', {
      headers: {
        'x-rapidapi-host': rapidApiHost,
        'x-rapidapi-key': rapidApiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`RapidAPI request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid JSON response format from RapidAPI');
    }

    const ipos: ScrapedIPO[] = data
      .map((item: any) => {
        const name = (item.name || '').trim();
        const priceMatches = (item.priceRange || '').match(/\d+(\.\d+)?/g);
        let issuePrice = 100;
        if (priceMatches && priceMatches.length > 0) {
          issuePrice = parseFloat(priceMatches[priceMatches.length - 1]);
        }

        // Clean raw date string (e.g. "12th – 14th Aug 2026")
        let openDate = 'N/A';
        let closeDate = 'N/A';
        if (item.ipoDate) {
          const dateLines = item.ipoDate.split('\n');
          const cleanDateStr = (dateLines[dateLines.length - 1] || '').trim();
          if (cleanDateStr) {
            const parts = cleanDateStr.split('–');
            openDate = (parts[0] || '').trim();
            closeDate = (parts[1] || parts[0] || '').trim();
          }
        }

        return {
          name,
          symbol: item.symbol || '',
          issuePrice: isNaN(issuePrice) ? 100 : issuePrice,
          lotSize: 15,
          openDate: openDate || 'N/A',
          closeDate: closeDate || 'N/A',
        };
      })
      .filter((item: ScrapedIPO) => item.name && item.name.length > 1);

    return NextResponse.json({
      success: true,
      source: 'RapidAPI Indian IPOs Dedicated API',
      count: ipos.length,
      ipos,
      data: ipos,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'API request failed';
    console.error('RapidAPI Fetch Error:', errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg, ipos: [], data: [] },
      { status: 500 }
    );
  }
}
