/* ================================================================
   Data — Minimal experiment structure

   Experiment: { id, ch, name, idea, tools, variations[] }
   Variation:  { id, name, started, stopped, changedStep, rateIdx, stages[] }
   Stage:      { label, val }
   Optional stage fields added by user: note, source, owner, connType
   ================================================================ */

var D = [
  {id:1, ch:'li_outreach', name:'Autopilot Outbound',
    idea:'ICP filter → connection requests → Dripify drip sequence',
    tools:'Sales Nav → Dripify',
    variations:[
      {id:'1a', name:'Default ICP filter', started:'Mar 24', stopped:false, rateIdx:[4,1],
        stages:[{label:'ICP filtered',val:500},{label:'Connections sent',val:200},{label:'Accepted',val:85},{label:'In Dripify',val:85},{label:'Replied',val:17},{label:'Signed up',val:3}]}
    ]},

  {id:2, ch:'lead_lists', name:'Post Engager Lead Lists',
    idea:'Scrape engagements from competitor posts → build lead lists → DM with context',
    tools:'Phantom → Sheets',
    variations:[
      {id:'2a', name:'All engagers, Template A', started:'Mar 24', stopped:false, rateIdx:[4,3],
        stages:[{label:'Posts found',val:12},{label:'Engagers scraped',val:680},{label:'ICP filtered',val:340},{label:'DMs sent',val:340},{label:'Replied',val:48},{label:'Signed up',val:8}]}
    ]},

  {id:3, ch:'li_outreach', name:'Referral Post DMs',
    idea:'Find "calling on my network" posts → DM people asking for recs',
    tools:'LinkedIn Search',
    variations:[
      {id:'3a', name:'Direct DM approach', started:'Mar 24', stopped:false, rateIdx:[3,2],
        stages:[{label:'Posts found',val:8},{label:'People identified',val:20},{label:'DMs sent',val:20},{label:'Replied',val:7},{label:'Signed up',val:2}]}
    ]},

  {id:4, ch:'li_outreach', name:'Influencer Monitor',
    idea:'Follow thought leaders → see which AEs engage → DM those AEs',
    tools:'LinkedIn',
    variations:[
      {id:'4a', name:'Cold DM after engagement', started:'Mar 24', stopped:false, rateIdx:[3,2],
        stages:[{label:'Influencers tracked',val:5},{label:'AEs surfaced',val:45},{label:'DMs sent',val:30},{label:'Replied',val:4},{label:'Signed up',val:1}]}
    ]},

  {id:5, ch:'warm_intros', name:'Network Mining',
    idea:'Mine LinkedIn network → warm intros to target accounts',
    tools:'LinkedIn',
    variations:[
      {id:'5a', name:'Standard intro ask', started:'Mar 25', stopped:false, rateIdx:[3,2],
        stages:[{label:'Target accounts',val:25},{label:'Mutual connections',val:15},{label:'Intro asks',val:10},{label:'Meetings',val:5},{label:'Signed up',val:3}]}
    ]},

  {id:6, ch:'gifts', name:'Personalized Gifts',
    idea:'Contact AE → get reply → send personalized gift → convert',
    tools:'LinkedIn → Sendoso',
    variations:[
      {id:'6a', name:'Book + handwritten note', started:'Mar 25', stopped:false, rateIdx:[3,2],
        stages:[{label:'AEs contacted',val:25},{label:'Replied',val:8},{label:'Gifts sent',val:6},{label:'Meetings',val:2},{label:'Signed up',val:1}]}
    ]},

  {id:7, ch:'events', name:'Coffee Events',
    idea:'Coffee at sales meetups → conversations about workflow pain',
    tools:'Meetup → in-person',
    variations:[
      {id:'7a', name:'Standard approach', started:'Mar 26', stopped:false, rateIdx:[3,1],
        stages:[{label:'Events',val:3},{label:'Conversations',val:40},{label:'Contacts',val:18},{label:'Signed up',val:3}]}
    ]},

  {id:17, ch:'li_content', name:'LinkedIn Content',
    idea:'Post daily about sales AI insights → build founder brand',
    tools:'LinkedIn',
    variations:[
      {id:'17a', name:'Text posts, daily', started:'Mar 24', stopped:false, rateIdx:[2,1],
        stages:[{label:'Posts',val:12},{label:'Impressions',val:2400},{label:'Engagements',val:86},{label:'Followers',val:12},{label:'Inbound DMs',val:3}]}
    ]},

  {id:13, ch:'content_seo', name:'AI SEO Sprint',
    idea:'AI SEO — rank for AE pain keywords',
    tools:'AI writer → WordPress',
    variations:[
      {id:'13a', name:'Initial', started:'—', stopped:false, rateIdx:[3,2],
        stages:[{label:'Pages published',val:0},{label:'Indexed',val:0},{label:'Site visits',val:0},{label:'Signed up',val:0}]}
    ]},

  {id:10, ch:'product', name:'Churn/Retention',
    idea:'Segment churned/returned/retained users → re-engage differently',
    tools:'Product analytics',
    variations:[
      {id:'10a', name:'Initial', started:'—', stopped:false, rateIdx:[2,1],
        stages:[{label:'Churned identified',val:0},{label:'Re-engaged',val:0},{label:'Returned',val:0},{label:'Retained',val:0}]}
    ]},

  {id:11, ch:'product', name:'Slack + In-App Messaging',
    idea:'Slack broadcasts + in-platform messaging for underused features',
    tools:'Slack → in-app',
    variations:[
      {id:'11a', name:'Initial', started:'—', stopped:false, rateIdx:[2,1],
        stages:[{label:'Messages sent',val:0},{label:'Opened',val:0},{label:'Engaged',val:0},{label:'Activated',val:0}]}
    ]}
];

var WE_SEED = [];
