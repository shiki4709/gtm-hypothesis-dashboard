/* ================================================================
   Data — Experiments with variations

   Each experiment = an approach being tested
   Each variation = a specific variable combination within that approach
   ================================================================ */

var D = [
  // ── OUTBOUND ──
  {id:1, ch:'li_outreach', name:'Autopilot Outbound',
    idea:'ICP filter → connection requests on autopilot → Dripify drip sequence',
    tools:'Sales Nav → Dripify',
    variations:[
      {id:'1a', name:'Default ICP filter',
        stages:[{label:'ICP filtered',val:500},{label:'Connections sent',val:200},{label:'Accepted',val:85},{label:'In Dripify',val:85},{label:'Replied',val:17},{label:'Signed up',val:3}],
        rateIdx:[4,1], started:'Mar 24', verdict:'', next:''},
    ]},

  {id:2, ch:'lead_lists', name:'Post Engager Lead Lists',
    idea:'Scrape engagements from competitor/industry posts → build lead lists → DM with context',
    tools:'Phantom → Sheets',
    variations:[
      {id:'2a', name:'All engagers, Template A',
        stages:[{label:'Posts found',val:12},{label:'Engagers scraped',val:680},{label:'ICP filtered',val:340},{label:'DMs sent',val:340},{label:'Replied',val:48},{label:'Signed up',val:8}],
        rateIdx:[4,3], started:'Mar 24', verdict:'Keep going', next:'Run on 5 more posts'},
    ]},

  {id:3, ch:'li_outreach', name:'Referral Post DMs',
    idea:'Find "calling on my network" posts → DM people asking for recs',
    tools:'LinkedIn Search',
    variations:[
      {id:'3a', name:'Direct DM approach',
        stages:[{label:'Posts found',val:8},{label:'People identified',val:20},{label:'DMs sent',val:20},{label:'Replied',val:7},{label:'Signed up',val:2}],
        rateIdx:[3,2], started:'Mar 24', verdict:'Keep going', next:''},
    ]},

  {id:4, ch:'li_outreach', name:'Influencer Monitor',
    idea:'Follow thought leaders → see which AEs engage → DM those AEs',
    tools:'LinkedIn',
    variations:[
      {id:'4a', name:'Cold DM after seeing engagement',
        stages:[{label:'Influencers tracked',val:5},{label:'AEs surfaced',val:45},{label:'DMs sent',val:30},{label:'Replied',val:4},{label:'Signed up',val:1}],
        rateIdx:[3,2], started:'Mar 24', verdict:'', next:''},
    ]},

  {id:5, ch:'warm_intros', name:'Network Mining',
    idea:'Mine LinkedIn network → warm intros to target accounts',
    tools:'LinkedIn',
    variations:[
      {id:'5a', name:'Standard intro ask',
        stages:[{label:'Target accounts',val:25},{label:'Mutual connections',val:15},{label:'Intro asks',val:10},{label:'Meetings',val:5},{label:'Signed up',val:3}],
        rateIdx:[3,2], started:'Mar 25', verdict:'Keep going', next:'Draft blurbs for Maruthi'},
    ]},

  {id:6, ch:'gifts', name:'Personalized Gifts',
    idea:'Research AE profile → find interesting angle → send personalized gift',
    tools:'LinkedIn → Sendoso',
    variations:[
      {id:'6a', name:'Book + handwritten note',
        stages:[{label:'AEs researched',val:25},{label:'Gifts sent',val:15},{label:'Responses',val:4},{label:'Meetings',val:2},{label:'Signed up',val:1}],
        rateIdx:[2,1], started:'Mar 25', verdict:'', next:''},
    ]},

  {id:7, ch:'events', name:'Coffee Events',
    idea:'Coffee at sales meetups → start conversations about workflow pain',
    tools:'Meetup → in-person',
    variations:[
      {id:'7a', name:'Standard approach',
        stages:[{label:'Events',val:3},{label:'Conversations',val:40},{label:'Contacts',val:18},{label:'Signed up',val:3}],
        rateIdx:[3,1], started:'Mar 26', verdict:'Close, iterate', next:'Try branded cups + QR code'},
    ]},

  // ── INBOUND ──
  {id:17, ch:'li_content', name:'LinkedIn Content',
    idea:'Post daily about sales AI insights → build founder brand',
    tools:'LinkedIn',
    variations:[
      {id:'17a', name:'Text posts, daily',
        stages:[{label:'Posts',val:12},{label:'Impressions',val:2400},{label:'Engagements',val:86},{label:'Followers',val:12},{label:'Inbound DMs',val:3}],
        rateIdx:[2,1], started:'Mar 24', verdict:'Keep going', next:'Test carousel format'},
    ]},

  {id:13, ch:'content_seo', name:'AI SEO Sprint',
    idea:'AI SEO — rank for AE pain keywords',
    tools:'AI writer → WordPress',
    variations:[
      {id:'13a', name:'Initial',
        stages:[{label:'Pages published',val:0},{label:'Indexed',val:0},{label:'Site visits',val:0},{label:'Signed up',val:0}],
        rateIdx:[3,2], started:'—', verdict:'Stop', next:'Parked. Focus outbound first.'},
    ]},

  {id:10, ch:'product', name:'Churn/Retention',
    idea:'Segment churned/returned/retained users → re-engage each differently',
    tools:'Product analytics',
    variations:[
      {id:'10a', name:'Initial',
        stages:[{label:'Churned identified',val:0},{label:'Re-engaged',val:0},{label:'Returned',val:0},{label:'Retained',val:0}],
        rateIdx:[2,1], started:'—', verdict:'', next:'Need product data access'},
    ]},

  {id:11, ch:'product', name:'Slack + In-App Messaging',
    idea:'Slack broadcasts + in-platform messaging for underused features',
    tools:'Slack → in-app',
    variations:[
      {id:'11a', name:'Initial',
        stages:[{label:'Messages sent',val:0},{label:'Opened',val:0},{label:'Engaged',val:0},{label:'Activated',val:0}],
        rateIdx:[2,1], started:'—', verdict:'', next:'Need analytics access'},
    ]},
];

/* ── Week seed data ── */
var WE_SEED = [
  {week:'W1',date:'Mar 24',
   outbound:{sourced:500,reached:200,converted:3,hours:10},
   inbound:{reach:1800,engaged:72,gained:8,hours:5},
   experiments:[]},
  {week:'W2',date:'Mar 31',
   outbound:{sourced:980,reached:520,converted:12,hours:18},
   inbound:{reach:3200,engaged:148,gained:18,hours:9},
   experiments:[]},
  {week:'W3',date:'Apr 7',
   outbound:{sourced:1500,reached:860,converted:18,hours:22},
   inbound:{reach:4865,engaged:205,gained:26,hours:12},
   experiments:[]},
];
