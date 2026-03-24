/* ================================================================
   Data — Seed experiments with methods pre-filled
   ================================================================ */

var D = [
  {id:1, ch:'li_outreach', name:'Autopilot Outbound',
    idea:'ICP filter → connection requests → Dripify drip sequence',
    tools:'Sales Nav → Dripify',
    variations:[
      {id:'1a', name:'Default ICP filter', started:'Mar 24', stopped:false, rateIdx:[4,1],
        stages:[
          {label:'ICP filtered',val:500, method:'Sales Nav → Saved Search → AE title + B2B SaaS'},
          {label:'Connections sent',val:200, method:'Sales Nav → Send 200/wk (LinkedIn cap)'},
          {label:'Accepted',val:85, method:'Auto-tracked via LinkedIn notifications'},
          {label:'In Dripify',val:85, method:'Dripify → Add accepted to drip campaign'},
          {label:'Replied',val:17, method:'Dripify → Campaign stats → Reply count'},
          {label:'Signed up',val:3, method:'CRM → Track signups from LinkedIn source'}
        ]}
    ]},

  {id:2, ch:'lead_lists', name:'Post Engager Lead Lists',
    idea:'Scrape engagements from competitor posts → build lead lists → DM with context',
    tools:'Phantom → Sheets',
    variations:[
      {id:'2a', name:'All engagers, Template A', started:'Mar 24', stopped:false, rateIdx:[4,3],
        stages:[
          {label:'Posts found',val:12, method:'LinkedIn Search → "sales" OR "GTM" → filter past week'},
          {label:'Engagers scraped',val:680, method:'Phantom Buster → Post Likers/Commenters → CSV'},
          {label:'ICP filtered',val:340, method:'Filter CSV → title contains "AE" OR "Account Exec"'},
          {label:'DMs sent',val:340, method:'Dripify Template A: "Hey {name}, saw you on {post}..."'},
          {label:'Replied',val:48, method:'LinkedIn inbox → count replies from this batch'},
          {label:'Signed up',val:8, method:'CRM → track signups'}
        ]}
    ]},

  {id:3, ch:'li_outreach', name:'Referral Post DMs',
    idea:'Find "calling on my network" posts → DM people asking for recs',
    tools:'LinkedIn Search',
    variations:[
      {id:'3a', name:'Direct DM approach', started:'Mar 24', stopped:false, rateIdx:[3,2],
        stages:[
          {label:'Posts found',val:8, method:'LinkedIn Search → "calling on my network" + past week'},
          {label:'People identified',val:20, method:'Read comments → find people asking for tool recs'},
          {label:'DMs sent',val:20, method:'Manual DM: "Saw your post — Nevara might help because..."'},
          {label:'Replied',val:7, method:'LinkedIn inbox'},
          {label:'Signed up',val:2, method:'CRM'}
        ]}
    ]},

  {id:4, ch:'li_outreach', name:'Influencer Monitor',
    idea:'Follow thought leaders → see which AEs engage → DM those AEs',
    tools:'LinkedIn',
    variations:[
      {id:'4a', name:'Cold DM after engagement', started:'Mar 24', stopped:false, rateIdx:[3,2],
        stages:[
          {label:'Influencers tracked',val:5, method:'Follow Mark Roberge, Jason Lemkin, etc.'},
          {label:'AEs surfaced',val:45, method:'Check who likes/comments on their posts'},
          {label:'DMs sent',val:30, method:'DM: "Saw you follow {influencer} — thought you\'d find this useful"'},
          {label:'Replied',val:4, method:'LinkedIn inbox'},
          {label:'Signed up',val:1, method:'CRM'}
        ]}
    ]},

  {id:5, ch:'warm_intros', name:'Network Mining',
    idea:'Mine LinkedIn network → warm intros to target accounts',
    tools:'LinkedIn',
    variations:[
      {id:'5a', name:'Standard intro ask', started:'Mar 25', stopped:false, rateIdx:[3,2],
        stages:[
          {label:'Target accounts',val:25, method:'CRM target list → high-growth B2B SaaS'},
          {label:'Mutual connections',val:15, method:'LinkedIn → each target → check shared connections'},
          {label:'Intro asks',val:10, method:'Message mutual: "Could you intro me to {name}?"'},
          {label:'Meetings',val:5, method:'Calendar → booked from intros'},
          {label:'Signed up',val:3, method:'CRM'}
        ]}
    ]},

  {id:6, ch:'gifts', name:'Personalized Gifts',
    idea:'Contact AE → get reply → send personalized gift → convert',
    tools:'LinkedIn → Sendoso',
    variations:[
      {id:'6a', name:'Book + handwritten note', started:'Mar 25', stopped:false, rateIdx:[3,2],
        stages:[
          {label:'AEs contacted',val:25, method:'LinkedIn DM → start conversation about their work'},
          {label:'Replied',val:8, method:'LinkedIn inbox → anyone who responds'},
          {label:'Gifts sent',val:6, method:'Sendoso → book + handwritten note based on convo'},
          {label:'Meetings',val:2, method:'Calendar'},
          {label:'Signed up',val:1, method:'CRM'}
        ]}
    ]},

  {id:7, ch:'events', name:'Coffee Events',
    idea:'Coffee at sales meetups → conversations about workflow pain',
    tools:'Meetup → in-person',
    variations:[
      {id:'7a', name:'Standard approach', started:'Mar 26', stopped:false, rateIdx:[3,1],
        stages:[
          {label:'Events',val:3, method:'Meetup.com → search "sales" events in area'},
          {label:'Conversations',val:40, method:'In-person → ask about their sales stack'},
          {label:'Contacts',val:18, method:'Exchange LinkedIn/cards at the event'},
          {label:'Signed up',val:3, method:'Follow up within 24hrs → CRM'}
        ]}
    ]},

  {id:17, ch:'li_content', name:'LinkedIn Content',
    idea:'Post daily about sales AI insights → build founder brand',
    tools:'LinkedIn',
    variations:[
      {id:'17a', name:'Text posts, daily', started:'Mar 24', stopped:false, rateIdx:[2,1],
        stages:[
          {label:'Posts',val:12, method:'Write 1 post/day → sales AI tips, AE workflows'},
          {label:'Impressions',val:2400, method:'LinkedIn analytics → post impressions'},
          {label:'Engagements',val:86, method:'LinkedIn analytics → likes + comments + shares'},
          {label:'Followers',val:12, method:'LinkedIn → Analytics → Followers → net new'},
          {label:'Inbound DMs',val:3, method:'LinkedIn inbox → unsolicited messages'}
        ]}
    ]},

  {id:13, ch:'content_seo', name:'AI SEO Sprint',
    idea:'AI SEO — rank for AE pain keywords',
    tools:'AI writer → WordPress',
    variations:[
      {id:'13a', name:'Initial', started:'—', stopped:false, rateIdx:[3,2],
        stages:[
          {label:'Pages published',val:0, method:'AI writer → target "sales AI tools" keywords'},
          {label:'Indexed',val:0, method:'Google Search Console → check indexing'},
          {label:'Site visits',val:0, method:'Google Analytics → organic traffic'},
          {label:'Signed up',val:0, method:'CRM'}
        ]}
    ]},

  {id:10, ch:'product', name:'Churn/Retention',
    idea:'Segment churned/returned/retained users → re-engage differently',
    tools:'Product analytics',
    variations:[
      {id:'10a', name:'Initial', started:'—', stopped:false, rateIdx:[2,1],
        stages:[
          {label:'Churned identified',val:0, method:'Product DB → inactive >30 days'},
          {label:'Re-engaged',val:0, method:'Email/Slack → win-back campaign'},
          {label:'Returned',val:0, method:'Product DB → logged in after re-engage'},
          {label:'Retained',val:0, method:'Product DB → active 7 days after return'}
        ]}
    ]},

  {id:11, ch:'product', name:'Slack + In-App Messaging',
    idea:'Slack broadcasts + in-platform messaging for underused features',
    tools:'Slack → in-app',
    variations:[
      {id:'11a', name:'Initial', started:'—', stopped:false, rateIdx:[2,1],
        stages:[
          {label:'Messages sent',val:0, method:'Slack → broadcast to #general'},
          {label:'Opened',val:0, method:'Slack analytics → message views'},
          {label:'Engaged',val:0, method:'Track clicks on feature links'},
          {label:'Activated',val:0, method:'Product DB → used the feature'}
        ]}
    ]}
];

var WE_SEED = [];
