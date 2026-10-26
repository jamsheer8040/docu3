export const uaeBanks = [
  { title: 'Habib Bank AG Zurich', value: 'Habib Bank AG Zurich', logo: '/banks/Habib Bank.jpeg' },
  { title: 'Ruya Bank', value: 'Ruya Bank', logo: '/banks/Ruya Bank.jpeg' },
  { title: 'Al Maryah Community Bank', value: 'Al Maryah Community Bank', logo: '/banks/Maryah Bank.jpeg' },
  { title: 'Wio Bank', value: 'Wio Bank', logo: '/banks/Wio Bank.jpeg' },
  { title: 'Bank of Baroda', value: 'Bank of Baroda', logo: '/banks/Bank of Baroda.jpeg' },
  { title: 'Citi Bank', value: 'Citi Bank', logo: '/banks/Citi Bank.jpeg' },
  { title: 'Al Hilal Bank', value: 'Al Hilal Bank', logo: '/banks/Hilal Bank.jpeg' },
  { title: 'Ajman Bank', value: 'Ajman Bank', logo: '/banks/Ajman Bank.jpeg' },
  { title: 'National Bank of Fujairah (NBF)', value: 'National Bank of Fujairah (NBF)', logo: '/banks/NBF.jpeg' },
  { title: 'HSBC', value: 'HSBC', logo: '/banks/HSBC.jpeg' },
  { title: 'RAKBANK', value: 'RAKBANK', logo: '/banks/Rak Bank.jpeg' },
  { title: 'Sharjah Islamic Bank (SIB)', value: 'Sharjah Islamic Bank (SIB)', logo: '/banks/SIB.jpeg' },
  { title: 'Standard Chartered', value: 'Standard Chartered', logo: '/banks/Standard Chartered.jpeg' },
  { title: 'Abu Dhabi Islamic Bank (ADIB)', value: 'Abu Dhabi Islamic Bank (ADIB)', logo: '/banks/ADIB.jpeg' },
  { title: 'Commercial Bank of Dubai (CBD)', value: 'Commercial Bank of Dubai (CBD)', logo: '/banks/CBD.jpeg' },
  { title: 'Dubai Islamic Bank (DIB)', value: 'Dubai Islamic Bank (DIB)', logo: '/banks/DIB.jpeg' },
  { title: 'Emirates Islamic', value: 'Emirates Islamic', logo: '/banks/Emirates Islamic.jpeg' },
  { title: 'Mashreq Bank', value: 'Mashreq Bank', logo: '/banks/Mashreq.jpeg' },
  { title: 'Abu Dhabi Commercial Bank (ADCB)', value: 'Abu Dhabi Commercial Bank (ADCB)', logo: '/banks/ADCB.jpeg' },
  { title: 'Emirates NBD', value: 'Emirates NBD', logo: '/banks/Emirates NBD.jpeg' },
  { title: 'First Abu Dhabi Bank (FAB)', value: 'First Abu Dhabi Bank (FAB)', logo: '/banks/FAB.jpeg' },
  { title: 'Other', value: 'Other', logo: '/banks/OTHER.png' }
];

export const getBankLogo = (accountName) => {
  if (!accountName) return null;
  const lowerName = accountName.toLowerCase();
  const match = uaeBanks.find(b => {
    const title = b.title.toLowerCase();
    if (lowerName.startsWith(title)) return true;
    if (title.includes('(')) {
      const abbr = title.split('(')[1].replace(')', '').trim();
      if (lowerName.startsWith(abbr)) return true;
    }
    return false;
  });
  return match ? match.logo : null;
};
