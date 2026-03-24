/* ================================================================
   Data — Experiments with variable-length pipeline stages
   Each experiment has: stages [{label, val}], rateIdx [num, denom]
   ================================================================ */

var D = [
  // ── OUTBOUND: LinkedIn Outreach ──
  {id:1, ch:'li_outreach', name:'Autopilot Outbound',
    started:'Mar 24', target:'>10% reply rate', targetNum:0.10,
    tools:'Sales Nav → Dripify',
    idea:'Reads ICP filters, clicks through profiles, sends connection requests on autopilot. 200/wk LinkedIn cap. Each lead → Sales Nav list → Dripify drip.',
    stages:[
      {label:'ICP filtered',val:500},
      {label:'Connections sent',val:200},
      {label:'Accepted',val:85},
      {label:'In Dripify drip',val:85},
      {label:'Replied',val:17},
      {label:'Signed up',val:3}
    ],
    rateIdx:[4,1], hours:4, verdict:'', next:''},

  {id:3, ch:'li_outreach', name:'Referral Post DMs',
    started:'Mar 24', target:'>30% reply rate', targetNum:0.30,
    tools:'LinkedIn Search',
    idea:'Find "calling on my network" posts. Identify people asking for recs. DM them with Nevara.',
    stages:[
      {label:'Referral posts found',val:8},
      {label:'People identified',val:20},
      {label:'DMs sent',val:20},
      {label:'Replied',val:7},
      {label:'Signed up',val:2}
    ],
    rateIdx:[3,2], hours:1.5, verdict:'Keep going', next:''},

  {id:4, ch:'li_outreach', name:'Influencer Monitor',
    started:'Mar 24', target:'>20% reply rate', targetNum:0.20,
    tools:'LinkedIn',
    idea:'Follow Mark Roberge etc. See which AE/sales reps engage with their posts. DM those AEs — they already care about sales improvement.',
    stages:[
      {label:'Influencers tracked',val:5},
      {label:'AEs surfaced',val:45},
      {label:'DMs sent',val:30},
      {label:'Replied',val:4},
      {label:'Signed up',val:1}
    ],
    rateIdx:[3,2], hours:2, verdict:'Change variables', next:'Try commenting on their posts first before DMing.'},

  // ── OUTBOUND: Lead Lists (Post Engager Scraping) ──
  {id:2, ch:'lead_lists', name:'Post Engager Lead Lists',
    started:'Mar 24', target:'>20% reply rate', targetNum:0.20,
    tools:'Phantom → Sheets',
    idea:'Scrape engagements from competitor/industry posts (rmeadows, etc). Build lead lists of AEs who engage with sales content. DM with personalized context about what they engaged with.',
    stages:[
      {label:'Posts found',val:12},
      {label:'Engagers scraped',val:680},
      {label:'ICP filtered',val:340},
      {label:'DMs sent',val:340},
      {label:'Replied',val:48},
      {label:'Signed up',val:8}
    ],
    rateIdx:[4,3], hours:3, verdict:'Keep going', next:'Run on 5 more posts. Commenters-only filter. Test DM template v2.'},

  {id:15, ch:'lead_lists', name:'Event Speaker Engagers',
    started:'Mar 25', target:'>25% reply rate', targetNum:0.25,
    tools:'Phantom',
    idea:'Scrape people who engage with event speaker posts (SaaStr, Pavilion). Build lists, DM with event context.',
    stages:[
      {label:'Speaker posts found',val:4},
      {label:'Engagers scraped',val:210},
      {label:'ICP filtered',val:85},
      {label:'DMs sent',val:85},
      {label:'Replied',val:12},
      {label:'Signed up',val:2}
    ],
    rateIdx:[4,3], hours:1.5, verdict:'', next:''},

  {id:16, ch:'lead_lists', name:'Competitor Commenters',
    started:'Mar 25', target:'>15% reply rate', targetNum:0.15,
    tools:'Phantom',
    idea:'Scrape commenters on Gong/Outreach/Salesloft posts. These AEs already care about sales tools.',
    stages:[
      {label:'Competitor posts',val:6},
      {label:'Commenters scraped',val:340},
      {label:'ICP filtered',val:120},
      {label:'DMs sent',val:120},
      {label:'Replied',val:15},
      {label:'Signed up',val:1}
    ],
    rateIdx:[4,3], hours:2, verdict:'', next:''},

  // ── OUTBOUND: Warm Intros ──
  {id:5, ch:'warm_intros', name:'Network Mining',
    started:'Mar 25', target:'>40% meeting rate', targetNum:0.40,
    tools:'LinkedIn',
    idea:'Go to LinkedIn network. See who is connected to target accounts. Ask for warm intros.',
    stages:[
      {label:'Target accounts',val:25},
      {label:'Mutual connections',val:15},
      {label:'Intro asks sent',val:10},
      {label:'Meetings booked',val:5},
      {label:'Signed up',val:3}
    ],
    rateIdx:[3,2], hours:1, verdict:'Keep going', next:'Draft blurbs for Maruthi.'},

  // ── OUTBOUND: Gift Outreach ──
  {id:6, ch:'gifts', name:'Personalized Gifts',
    started:'Mar 25', target:'>35% response rate', targetNum:0.35,
    tools:'LinkedIn → Sendoso',
    idea:'Go to AE profile. Find interesting thing about them. Send a personalized gift with Nevara context.',
    stages:[
      {label:'AEs researched',val:25},
      {label:'Gifts sent',val:15},
      {label:'Responses',val:4},
      {label:'Meetings',val:2},
      {label:'Signed up',val:1}
    ],
    rateIdx:[2,1], hours:3, verdict:'', next:''},

  // ── OUTBOUND: Events ──
  {id:7, ch:'events', name:'Coffee Events',
    started:'Mar 26', target:'>10% conv-to-signup', targetNum:0.10,
    tools:'Meetup → in-person',
    idea:'Coffee at sales meetups. Start conversations with AEs about their workflow pain.',
    stages:[
      {label:'Events attended',val:3},
      {label:'Conversations',val:40},
      {label:'Contacts collected',val:18},
      {label:'Signed up',val:3}
    ],
    rateIdx:[3,1], hours:5, verdict:'Close, iterate', next:'Book 2 more. Try branded cups + QR.'},

  // ── INBOUND: LinkedIn Posts ──
  {id:17, ch:'li_content', name:'Daily Insight Posts',
    started:'Mar 24', target:'>3% engagement', targetNum:0.03,
    tools:'LinkedIn',
    idea:'Post daily about sales AI insights, AE workflow tips, deal execution patterns. Build Maruthi founder brand.',
    stages:[
      {label:'Posts published',val:12},
      {label:'Impressions',val:2400},
      {label:'Engagements',val:86},
      {label:'Followers gained',val:12},
      {label:'Inbound DMs',val:3}
    ],
    rateIdx:[2,1], hours:3, verdict:'Keep going', next:'Test carousel format. Add CTA in comments.'},

  {id:18, ch:'li_content', name:'Customer Win Stories',
    started:'Mar 25', target:'>5% engagement', targetNum:0.05,
    tools:'LinkedIn',
    idea:'Share anonymized customer wins — how Nevara helped close deals faster.',
    stages:[
      {label:'Stories published',val:3},
      {label:'Impressions',val:800},
      {label:'Engagements',val:52},
      {label:'Followers gained',val:5},
      {label:'Inbound DMs',val:1}
    ],
    rateIdx:[2,1], hours:1.5, verdict:'', next:''},

  // ── INBOUND: Twitter ──
  {id:8, ch:'twitter', name:'Thought Leadership Threads',
    started:'Mar 24', target:'>2% engagement', targetNum:0.02,
    tools:'Twitter/X',
    idea:'Post threads on sales AI, reply to sales leaders. Build presence in #SalesTwitter.',
    stages:[
      {label:'Threads posted',val:8},
      {label:'Impressions',val:1200},
      {label:'Engagements',val:28},
      {label:'Followers gained',val:4},
      {label:'Inbound DMs',val:0}
    ],
    rateIdx:[2,1], hours:2, verdict:'', next:''},

  {id:19, ch:'twitter', name:'Reply-to-Influencers',
    started:'Mar 24', target:'>5% engagement', targetNum:0.05,
    tools:'Twitter/X',
    idea:'Surface the right people on Twitter. Strategic replies to @jasonlk, sales thought leaders. Get visible in their threads.',
    stages:[
      {label:'People surfaced',val:30},
      {label:'Replies posted',val:45},
      {label:'Impressions',val:450},
      {label:'Engagements',val:31},
      {label:'Followers gained',val:2}
    ],
    rateIdx:[3,2], hours:1, verdict:'Keep going', next:'Focus on threads with <10 replies for visibility.'},

  // ── INBOUND: Reddit ──
  {id:9, ch:'reddit', name:'r/sales Authority',
    started:'Mar 24', target:'>10% upvote rate', targetNum:0.10,
    tools:'Reddit',
    idea:'Surface posts on r/sales, r/salesengineers about sales pain. Reply with value-first, detailed answers. Build credibility.',
    stages:[
      {label:'Posts surfaced',val:25},
      {label:'Replies written',val:15},
      {label:'Upvotes',val:8},
      {label:'Profile visits',val:12},
      {label:'DMs received',val:3}
    ],
    rateIdx:[2,1], hours:1.5, verdict:'Keep going', next:'Continue building presence. Post 1 long-form per week.'},

  // ── INBOUND: Content/SEO ──
  {id:13, ch:'content_seo', name:'AI SEO Sprint',
    started:'—', target:'>2% visit-to-signup', targetNum:0.02,
    tools:'AI writer → WordPress',
    idea:'AI SEO optimization — rank for AE pain keywords.',
    stages:[
      {label:'Pages published',val:0},
      {label:'Indexed',val:0},
      {label:'Site visits',val:0},
      {label:'Signed up',val:0}
    ],
    rateIdx:[3,2], hours:0, verdict:'Stop', next:'Parked. Focus outbound first.'},

  {id:14, ch:'content_seo', name:'Cross-Channel Content',
    started:'—', target:'>50 impressions/post', targetNum:0.01,
    tools:'Multi-platform',
    idea:'Organic content across LinkedIn, Twitter, Reddit, Hacker News, Quora, and similar communities.',
    stages:[
      {label:'Posts published',val:0},
      {label:'Total impressions',val:0},
      {label:'Engagements',val:0},
      {label:'Site visits',val:0},
      {label:'Signed up',val:0}
    ],
    rateIdx:[2,1], hours:0, verdict:'Stop', next:'Parked. Needs 30+ posts.'},

  // ── INBOUND: Product ──
  {id:10, ch:'product', name:'Churn/Retention Segmentation',
    started:'—', target:'>5% reactivation', targetNum:0.05,
    tools:'Product analytics',
    idea:'Which user has churned, which returned, which retained. Segment and re-engage each cohort differently.',
    stages:[
      {label:'Churned identified',val:0},
      {label:'Re-engaged',val:0},
      {label:'Returned',val:0},
      {label:'Retained',val:0}
    ],
    rateIdx:[2,1], hours:0, verdict:'', next:'Need product data access.'},

  {id:11, ch:'product', name:'Slack + In-App Messaging',
    started:'—', target:'>15% engagement', targetNum:0.15,
    tools:'Slack → in-app',
    idea:'Slack broadcasts and in-platform messaging for underused features.',
    stages:[
      {label:'Messages sent',val:0},
      {label:'Opened',val:0},
      {label:'Engaged',val:0},
      {label:'Activated',val:0}
    ],
    rateIdx:[2,1], hours:0, verdict:'', next:'Need analytics access.'},

  {id:12, ch:'product', name:'Docs Rewrite',
    started:'—', target:'>30% fewer tickets', targetNum:0.30,
    tools:'Docs platform',
    idea:'Product documentation and enablement. Reduce support tickets.',
    stages:[
      {label:'Pages rewritten',val:0},
      {label:'Page views',val:0},
      {label:'Ticket reduction',val:0}
    ],
    rateIdx:[2,1], hours:0, verdict:'', next:'Need support data.'}
];

/* ── Week seed data ── */
var WE_SEED = [
  {week:'W1',date:'Mar 24',
   outbound:{sourced:500,reached:200,converted:3,hours:10},
   inbound:{reach:1800,engaged:72,gained:8,hours:5},
   experiments:[
     {id:1,name:'Autopilot Outbound',ch:'li_outreach',stages:[{label:'ICP filtered',val:500},{label:'Connections sent',val:200},{label:'Accepted',val:60},{label:'In Dripify',val:60},{label:'Replied',val:10},{label:'Signed up',val:1}],rateIdx:[4,1],hours:4,verdict:'',target:'>10% reply rate',targetNum:0.10},
     {id:2,name:'Post Engager Lead Lists',ch:'lead_lists',stages:[{label:'Posts found',val:5},{label:'Scraped',val:300},{label:'Filtered',val:120},{label:'DMs sent',val:120},{label:'Replied',val:21},{label:'Signed up',val:3}],rateIdx:[4,3],hours:2,verdict:'Keep going',target:'>20% reply rate',targetNum:0.20}
   ]},
  {week:'W2',date:'Mar 31',
   outbound:{sourced:980,reached:520,converted:12,hours:18},
   inbound:{reach:3200,engaged:148,gained:18,hours:9},
   experiments:[
     {id:1,name:'Autopilot Outbound',ch:'li_outreach',stages:[{label:'ICP filtered',val:500},{label:'Connections sent',val:200},{label:'Accepted',val:75},{label:'In Dripify',val:75},{label:'Replied',val:14},{label:'Signed up',val:2}],rateIdx:[4,1],hours:4,verdict:'',target:'>10% reply rate',targetNum:0.10},
     {id:2,name:'Post Engager Lead Lists',ch:'lead_lists',stages:[{label:'Posts found',val:9},{label:'Scraped',val:500},{label:'Filtered',val:280},{label:'DMs sent',val:280},{label:'Replied',val:38},{label:'Signed up',val:6}],rateIdx:[4,3],hours:3,verdict:'Keep going',target:'>20% reply rate',targetNum:0.20},
     {id:3,name:'Referral Post DMs',ch:'li_outreach',stages:[{label:'Posts found',val:5},{label:'People identified',val:14},{label:'DMs sent',val:14},{label:'Replied',val:5},{label:'Signed up',val:1}],rateIdx:[3,2],hours:1.5,verdict:'Keep going',target:'>30% reply rate',targetNum:0.30},
     {id:17,name:'Daily Insight Posts',ch:'li_content',stages:[{label:'Published',val:7},{label:'Impressions',val:1600},{label:'Engagements',val:62},{label:'Followers',val:8},{label:'DMs',val:1}],rateIdx:[2,1],hours:2,verdict:'Keep going',target:'>3% engagement',targetNum:0.03}
   ]},
  {week:'W3',date:'Apr 7',
   outbound:{sourced:1500,reached:860,converted:18,hours:22},
   inbound:{reach:4865,engaged:205,gained:26,hours:12},
   experiments:[
     {id:1,name:'Autopilot Outbound',ch:'li_outreach',stages:[{label:'ICP filtered',val:500},{label:'Connections sent',val:200},{label:'Accepted',val:85},{label:'In Dripify',val:85},{label:'Replied',val:17},{label:'Signed up',val:3}],rateIdx:[4,1],hours:4,verdict:'',target:'>10% reply rate',targetNum:0.10},
     {id:2,name:'Post Engager Lead Lists',ch:'lead_lists',stages:[{label:'Posts found',val:12},{label:'Scraped',val:680},{label:'Filtered',val:340},{label:'DMs sent',val:340},{label:'Replied',val:48},{label:'Signed up',val:8}],rateIdx:[4,3],hours:3,verdict:'Keep going',target:'>20% reply rate',targetNum:0.20},
     {id:5,name:'Network Mining',ch:'warm_intros',stages:[{label:'Targets',val:25},{label:'Mutuals',val:15},{label:'Asks',val:10},{label:'Meetings',val:5},{label:'Signed up',val:3}],rateIdx:[3,2],hours:1,verdict:'Keep going',target:'>40% meeting rate',targetNum:0.40},
     {id:17,name:'Daily Insight Posts',ch:'li_content',stages:[{label:'Published',val:12},{label:'Impressions',val:2400},{label:'Engagements',val:86},{label:'Followers',val:12},{label:'DMs',val:3}],rateIdx:[2,1],hours:3,verdict:'Keep going',target:'>3% engagement',targetNum:0.03},
     {id:9,name:'r/sales Authority',ch:'reddit',stages:[{label:'Surfaced',val:25},{label:'Replies',val:15},{label:'Upvotes',val:8},{label:'Visits',val:12},{label:'DMs',val:3}],rateIdx:[2,1],hours:1.5,verdict:'Keep going',target:'>10% upvote rate',targetNum:0.10}
   ]}
];
