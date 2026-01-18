# Live Collaboration & Multi-Community System - Part 2
## Task Documentation: GIT-9 through GIT-11

This is a continuation of the Live Collaboration & Multi-Community System task documentation.

---

## GIT-9: Community Tab UI/UX

**Priority**: High  
**Estimated Hours**: 80-100  
**Dependencies**: GIT-5, GIT-7, GIT-8

### Purpose

Create the Community tab UI that serves as the central hub for all community features: browsing communities, discovering sessions, exploring components, viewing tutorials, and accessing discussions.

### Technical Requirements

#### 1. Community Tab Layout

**File: `packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/CommunityPanel.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { CommunityManager } from '../../../services/CommunityManager';
import { CollaborationManager } from '../../../services/CollaborationManager';
import { NotificationManager } from '../../../services/NotificationManager';

interface CommunityPanelProps {
  communityManager: CommunityManager;
  collaborationManager: CollaborationManager;
  notificationManager: NotificationManager;
}

export function CommunityPanel({
  communityManager,
  collaborationManager,
  notificationManager
}: CommunityPanelProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'sessions' | 'components' | 'learn' | 'discuss' | 'jobs'>('home');
  const [activeCommunity, setActiveCommunity] = useState(communityManager.getActiveCommunity());
  const [communities, setCommunities] = useState(communityManager.getCommunities());
  
  useEffect(() => {
    const handleCommunityChanged = (community: any) => {
      setActiveCommunity(community);
    };
    
    const handleCommunitiesUpdated = () => {
      setCommunities(communityManager.getCommunities());
    };
    
    communityManager.on('active-community-changed', handleCommunityChanged);
    communityManager.on('community-added', handleCommunitiesUpdated);
    communityManager.on('community-removed', handleCommunitiesUpdated);
    
    return () => {
      communityManager.off('active-community-changed', handleCommunityChanged);
      communityManager.off('community-added', handleCommunitiesUpdated);
      communityManager.off('community-removed', handleCommunitiesUpdated);
    };
  }, [communityManager]);
  
  return (
    <div className="community-panel">
      <CommunityHeader
        communities={communities}
        activeCommunity={activeCommunity}
        onCommunityChange={(id) => communityManager.setActiveCommunity(id)}
        onAddCommunity={() => showAddCommunityDialog()}
      />
      
      <div className="community-navigation">
        <NavButton
          icon="🏠"
          label="Home"
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavButton
          icon="👥"
          label="Sessions"
          active={activeTab === 'sessions'}
          badge={getActiveSessionCount()}
          onClick={() => setActiveTab('sessions')}
        />
        <NavButton
          icon="📦"
          label="Components"
          active={activeTab === 'components'}
          onClick={() => setActiveTab('components')}
        />
        <NavButton
          icon="🎓"
          label="Learn"
          active={activeTab === 'learn'}
          onClick={() => setActiveTab('learn')}
        />
        <NavButton
          icon="💬"
          label="Discuss"
          active={activeTab === 'discuss'}
          onClick={() => setActiveTab('discuss')}
        />
        <NavButton
          icon="💼"
          label="Jobs"
          active={activeTab === 'jobs'}
          onClick={() => setActiveTab('jobs')}
        />
      </div>
      
      <div className="community-content">
        {activeTab === 'home' && (
          <HomeView
            community={activeCommunity}
            collaborationManager={collaborationManager}
            notificationManager={notificationManager}
          />
        )}
        {activeTab === 'sessions' && (
          <SessionsView
            community={activeCommunity}
            collaborationManager={collaborationManager}
          />
        )}
        {activeTab === 'components' && (
          <ComponentsView
            community={activeCommunity}
          />
        )}
        {activeTab === 'learn' && (
          <LearnView
            community={activeCommunity}
          />
        )}
        {activeTab === 'discuss' && (
          <DiscussView
            community={activeCommunity}
          />
        )}
        {activeTab === 'jobs' && (
          <JobsView
            community={activeCommunity}
          />
        )}
      </div>
    </div>
  );
}
```

#### 2. Home View (Featured Content)

**File: `CommunityPanel/views/HomeView.tsx`**

```typescript
import React, { useEffect, useState } from 'react';

export function HomeView({ community, collaborationManager, notificationManager }) {
  const [featured, setFeatured] = useState({
    sessions: [],
    components: [],
    tutorials: [],
    discussions: []
  });
  
  useEffect(() => {
    loadFeaturedContent();
  }, [community]);
  
  async function loadFeaturedContent() {
    // Fetch from community repository
    const response = await fetch(
      `https://raw.githubusercontent.com/${getCommunityRepo()}/main/featured.json`
    );
    const data = await response.json();
    setFeatured(data);
  }
  
  return (
    <div className="home-view">
      <WelcomeBanner community={community} />
      
      <Section title="🔴 Live Now" icon="pulse">
        <ActiveSessionsList
          sessions={featured.sessions}
          onJoin={(sessionId) => joinSession(sessionId)}
        />
      </Section>
      
      <Section title="⭐ Featured This Week">
        <FeaturedGrid items={featured.components} type="component" />
      </Section>
      
      <Section title="📺 New Tutorials">
        <TutorialList tutorials={featured.tutorials} />
      </Section>
      
      <Section title="💬 Hot Discussions">
        <DiscussionList discussions={featured.discussions} />
      </Section>
      
      <QuickActions
        onStartSession={() => startNewSession()}
        onShareComponent={() => shareComponent()}
        onAskQuestion={() => startDiscussion()}
      />
    </div>
  );
}

function WelcomeBanner({ community }) {
  return (
    <div className="welcome-banner" style={{ borderColor: community.config.branding.primaryColor }}>
      <img src={community.config.branding.logo} alt={community.name} />
      <h2>{community.name}</h2>
      <p>{community.description}</p>
      <div className="community-stats">
        <Stat icon="👥" value="1,234" label="Members" />
        <Stat icon="📦" value="567" label="Components" />
        <Stat icon="🎓" value="89" label="Tutorials" />
        <Stat icon="🔴" value="12" label="Live Now" />
      </div>
    </div>
  );
}

function ActiveSessionsList({ sessions, onJoin }) {
  if (sessions.length === 0) {
    return <EmptyState message="No live sessions right now. Start one!" />;
  }
  
  return (
    <div className="sessions-list">
      {sessions.map(session => (
        <SessionCard
          key={session.id}
          session={session}
          onJoin={() => onJoin(session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({ session, onJoin }) {
  return (
    <div className="session-card">
      <div className="session-header">
        <div className="session-host">
          <Avatar src={session.host.avatar} size={32} />
          <span>{session.host.name}</span>
        </div>
        <LiveIndicator />
      </div>
      
      <h3>{session.title}</h3>
      <p>{session.description}</p>
      
      <div className="session-meta">
        <span>👥 {session.participants.length}/{session.maxParticipants}</span>
        <span>🕐 {formatDuration(session.duration)}</span>
        {session.audioEnabled && <span>🎤 Audio</span>}
        {session.videoEnabled && <span>📹 Video</span>}
      </div>
      
      <button className="join-button" onClick={onJoin}>
        Join Session
      </button>
    </div>
  );
}

function QuickActions({ onStartSession, onShareComponent, onAskQuestion }) {
  return (
    <div className="quick-actions">
      <ActionButton
        icon="🚀"
        label="Start Collaboration"
        onClick={onStartSession}
        primary
      />
      <ActionButton
        icon="📦"
        label="Share Component"
        onClick={onShareComponent}
      />
      <ActionButton
        icon="❓"
        label="Ask Question"
        onClick={onAskQuestion}
      />
    </div>
  );
}
```

#### 3. Sessions View (Collaboration Discovery)

**File: `CommunityPanel/views/SessionsView.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export function SessionsView({ community, collaborationManager }) {
  const [view, setView] = useState<'browse' | 'create' | 'join'>('browse');
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState({
    status: 'all', // 'live', 'scheduled', 'all'
    hasAudio: false,
    hasSlots: false
  });
  
  useEffect(() => {
    loadSessions();
  }, [community, filter]);
  
  async function loadSessions() {
    // Fetch from community's collaboration/public-sessions.json
    const response = await fetch(
      `https://raw.githubusercontent.com/${getCommunityRepo()}/main/collaboration/public-sessions.json`
    );
    const data = await response.json();
    setSessions(filterSessions(data, filter));
  }
  
  return (
    <div className="sessions-view">
      <div className="sessions-header">
        <h2>Collaboration Sessions</h2>
        <div className="sessions-actions">
          <button onClick={() => setView('create')} className="primary">
            🚀 Start New Session
          </button>
          <button onClick={() => setView('join')}>
            🔗 Join via Link
          </button>
        </div>
      </div>
      
      {view === 'browse' && (
        <>
          <SessionFilters
            filter={filter}
            onChange={setFilter}
          />
          
          <div className="sessions-grid">
            {sessions.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No sessions found"
                message="Be the first to start a collaboration session!"
                action={{
                  label: "Start Session",
                  onClick: () => setView('create')
                }}
              />
            ) : (
              sessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onJoin={() => joinSession(session.roomId)}
                />
              ))
            )}
          </div>
        </>
      )}
      
      {view === 'create' && (
        <CreateSessionDialog
          onCancel={() => setView('browse')}
          onCreate={(session) => {
            createSession(session);
            setView('browse');
          }}
        />
      )}
      
      {view === 'join' && (
        <JoinSessionDialog
          onCancel={() => setView('browse')}
          onJoin={(roomId) => {
            joinSession(roomId);
            setView('browse');
          }}
        />
      )}
    </div>
  );
}

function SessionFilters({ filter, onChange }) {
  return (
    <div className="session-filters">
      <FilterGroup label="Status">
        <Radio
          label="All"
          checked={filter.status === 'all'}
          onChange={() => onChange({ ...filter, status: 'all' })}
        />
        <Radio
          label="Live Now"
          checked={filter.status === 'live'}
          onChange={() => onChange({ ...filter, status: 'live' })}
        />
        <Radio
          label="Scheduled"
          checked={filter.status === 'scheduled'}
          onChange={() => onChange({ ...filter, status: 'scheduled' })}
        />
      </FilterGroup>
      
      <FilterGroup label="Features">
        <Checkbox
          label="Audio Enabled"
          checked={filter.hasAudio}
          onChange={(checked) => onChange({ ...filter, hasAudio: checked })}
        />
        <Checkbox
          label="Has Available Slots"
          checked={filter.hasSlots}
          onChange={(checked) => onChange({ ...filter, hasSlots: checked })}
        />
      </FilterGroup>
    </div>
  );
}

function CreateSessionDialog({ onCancel, onCreate }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    isPublic: true,
    maxParticipants: 10,
    audioEnabled: true,
    videoEnabled: false,
    projectId: window.ProjectModel?.id || ''
  });
  
  return (
    <Dialog title="Start Collaboration Session" onClose={onCancel}>
      <Form>
        <Input
          label="Session Title"
          value={form.title}
          onChange={(title) => setForm({ ...form, title })}
          placeholder="e.g., Building a User Dashboard"
          required
        />
        
        <TextArea
          label="Description"
          value={form.description}
          onChange={(description) => setForm({ ...form, description })}
          placeholder="What will you be working on?"
          rows={3}
        />
        
        <Select
          label="Project"
          value={form.projectId}
          onChange={(projectId) => setForm({ ...form, projectId })}
          options={getAvailableProjects()}
        />
        
        <Checkbox
          label="Public Session (visible to community)"
          checked={form.isPublic}
          onChange={(isPublic) => setForm({ ...form, isPublic })}
        />
        
        <NumberInput
          label="Max Participants"
          value={form.maxParticipants}
          onChange={(maxParticipants) => setForm({ ...form, maxParticipants })}
          min={2}
          max={20}
        />
        
        <CheckboxGroup label="Features">
          <Checkbox
            label="🎤 Enable Audio Chat"
            checked={form.audioEnabled}
            onChange={(audioEnabled) => setForm({ ...form, audioEnabled })}
          />
          <Checkbox
            label="📹 Enable Video"
            checked={form.videoEnabled}
            onChange={(videoEnabled) => setForm({ ...form, videoEnabled })}
          />
        </CheckboxGroup>
        
        <ButtonGroup>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onCreate(form)}
            disabled={!form.title || !form.projectId}
            primary
          >
            Start Session
          </Button>
        </ButtonGroup>
      </Form>
    </Dialog>
  );
}

function JoinSessionDialog({ onCancel, onJoin }) {
  const [roomId, setRoomId] = useState('');
  
  return (
    <Dialog title="Join Collaboration Session" onClose={onCancel}>
      <Form>
        <p>Enter the session link or room ID shared with you:</p>
        
        <Input
          label="Session Link or Room ID"
          value={roomId}
          onChange={setRoomId}
          placeholder="nodegx-session://abc123 or abc123"
        />
        
        <ButtonGroup>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onJoin(extractRoomId(roomId))}
            disabled={!roomId}
            primary
          >
            Join
          </Button>
        </ButtonGroup>
      </Form>
    </Dialog>
  );
}
```

#### 4. Components View

**File: `CommunityPanel/views/ComponentsView.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export function ComponentsView({ community }) {
  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'recent' | 'popular' | 'name'>('popular');
  
  useEffect(() => {
    loadComponents();
  }, [community, search, category, sort]);
  
  async function loadComponents() {
    // Fetch from community's components/registry.json
    const response = await fetch(
      `https://raw.githubusercontent.com/${getCommunityRepo()}/main/components/registry.json`
    );
    const data = await response.json();
    setComponents(filterAndSort(data, search, category, sort));
  }
  
  return (
    <div className="components-view">
      <div className="components-header">
        <h2>Component Library</h2>
        <button onClick={() => shareComponent()} className="primary">
          📦 Share Component
        </button>
      </div>
      
      <div className="components-toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search components..."
        />
        
        <CategoryFilter
          value={category}
          onChange={setCategory}
          categories={getCategories()}
        />
        
        <SortDropdown
          value={sort}
          onChange={setSort}
          options={[
            { value: 'popular', label: 'Most Popular' },
            { value: 'recent', label: 'Recently Added' },
            { value: 'name', label: 'Name A-Z' }
          ]}
        />
      </div>
      
      <div className="components-grid">
        {components.map(component => (
          <ComponentCard
            key={component.id}
            component={component}
            onInstall={() => installComponent(component)}
            onPreview={() => previewComponent(component)}
          />
        ))}
      </div>
    </div>
  );
}

function ComponentCard({ component, onInstall, onPreview }) {
  return (
    <div className="component-card">
      <div className="component-preview">
        {component.screenshot ? (
          <img src={component.screenshot} alt={component.name} />
        ) : (
          <div className="component-icon">{component.icon || '📦'}</div>
        )}
      </div>
      
      <div className="component-info">
        <h3>{component.name}</h3>
        <p className="component-description">{component.description}</p>
        
        <div className="component-meta">
          <Avatar src={component.author.avatar} size={20} />
          <span>{component.author.name}</span>
          <span>•</span>
          <span>⭐ {component.stars}</span>
          <span>•</span>
          <span>📥 {component.downloads}</span>
        </div>
        
        <div className="component-tags">
          {component.tags?.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>
      
      <div className="component-actions">
        <button onClick={onPreview} className="secondary">
          👁️ Preview
        </button>
        <button onClick={onInstall} className="primary">
          📥 Add to Library
        </button>
      </div>
    </div>
  );
}
```

#### 5. Learn View (Tutorials)

**File: `CommunityPanel/views/LearnView.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export function LearnView({ community }) {
  const [tutorials, setTutorials] = useState([]);
  const [level, setLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [format, setFormat] = useState<'all' | 'video' | 'article' | 'interactive'>('all');
  
  useEffect(() => {
    loadTutorials();
  }, [community, level, format]);
  
  async function loadTutorials() {
    // Fetch from community's tutorials/
    const levels = level === 'all' ? ['beginner', 'intermediate', 'advanced'] : [level];
    const allTutorials = [];
    
    for (const lvl of levels) {
      const response = await fetch(
        `https://raw.githubusercontent.com/${getCommunityRepo()}/main/tutorials/${lvl}/index.json`
      );
      const data = await response.json();
      allTutorials.push(...data);
    }
    
    setTutorials(filterTutorials(allTutorials, format));
  }
  
  return (
    <div className="learn-view">
      <div className="learn-header">
        <h2>Learning Resources</h2>
        <button onClick={() => submitTutorial()} className="primary">
          ➕ Submit Tutorial
        </button>
      </div>
      
      <LearningPath
        title="Getting Started with Nodegx"
        description="Complete beginner's path to building your first app"
        steps={getGettingStartedPath()}
      />
      
      <div className="tutorials-filters">
        <SegmentedControl
          label="Level"
          value={level}
          onChange={setLevel}
          options={[
            { value: 'all', label: 'All Levels' },
            { value: 'beginner', label: '🌱 Beginner' },
            { value: 'intermediate', label: '🌿 Intermediate' },
            { value: 'advanced', label: '🌳 Advanced' }
          ]}
        />
        
        <SegmentedControl
          label="Format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'all', label: 'All' },
            { value: 'video', label: '📺 Video' },
            { value: 'article', label: '📄 Article' },
            { value: 'interactive', label: '🎮 Interactive' }
          ]}
        />
      </div>
      
      <div className="tutorials-grid">
        {tutorials.map(tutorial => (
          <TutorialCard
            key={tutorial.id}
            tutorial={tutorial}
            onStart={() => startTutorial(tutorial)}
          />
        ))}
      </div>
    </div>
  );
}

function TutorialCard({ tutorial, onStart }) {
  return (
    <div className="tutorial-card">
      <div className="tutorial-thumbnail">
        <img src={tutorial.thumbnail} alt={tutorial.title} />
        <div className="tutorial-duration">{tutorial.duration}</div>
        <div className="tutorial-format">{formatIcon(tutorial.format)}</div>
      </div>
      
      <div className="tutorial-content">
        <div className="tutorial-level">
          <Badge color={getLevelColor(tutorial.level)}>
            {tutorial.level}
          </Badge>
        </div>
        
        <h3>{tutorial.title}</h3>
        <p>{tutorial.description}</p>
        
        <div className="tutorial-meta">
          <Avatar src={tutorial.author.avatar} size={20} />
          <span>{tutorial.author.name}</span>
          <span>•</span>
          <span>{tutorial.publishedAt}</span>
        </div>
      </div>
      
      <button onClick={onStart} className="tutorial-start">
        Start Learning →
      </button>
    </div>
  );
}
```

#### 6. Discuss View (GitHub Discussions)

**File: `CommunityPanel/views/DiscussView.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';

export function DiscussView({ community }) {
  const [discussions, setDiscussions] = useState([]);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'recent' | 'top' | 'unanswered'>('recent');
  
  useEffect(() => {
    loadDiscussions();
  }, [community, category, sort]);
  
  async function loadDiscussions() {
    const octokit = new Octokit({
      auth: window.githubAuth.token
    });
    
    // Fetch GitHub Discussions
    const [owner, repo] = community.repository.split('/').slice(-2);
    
    const { data } = await octokit.graphql(`
      query {
        repository(owner: "${owner}", name: "${repo}") {
          discussions(first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              title
              body
              createdAt
              updatedAt
              category {
                name
              }
              author {
                login
                avatarUrl
              }
              comments {
                totalCount
              }
              reactions {
                totalCount
              }
              url
            }
          }
        }
      }
    `);
    
    setDiscussions(filterDiscussions(data.repository.discussions.nodes, category, sort));
  }
  
  return (
    <div className="discuss-view">
      <div className="discuss-header">
        <h2>Community Discussions</h2>
        <button onClick={() => startDiscussion()} className="primary">
          💬 Start Discussion
        </button>
      </div>
      
      <div className="discuss-filters">
        <CategoryTabs
          value={category}
          onChange={setCategory}
          categories={[
            { value: 'all', label: 'All' },
            { value: 'Q&A', label: '❓ Q&A' },
            { value: 'Show and Tell', label: '✨ Show and Tell' },
            { value: 'Ideas', label: '💡 Ideas' },
            { value: 'General', label: '💬 General' }
          ]}
        />
        
        <SortDropdown
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Recent Activity' },
            { value: 'top', label: 'Top Discussions' },
            { value: 'unanswered', label: 'Unanswered' }
          ]}
        />
      </div>
      
      <div className="discussions-list">
        {discussions.map(discussion => (
          <DiscussionItem
            key={discussion.id}
            discussion={discussion}
            onClick={() => openDiscussion(discussion.url)}
          />
        ))}
      </div>
    </div>
  );
}

function DiscussionItem({ discussion, onClick }) {
  return (
    <div className="discussion-item" onClick={onClick}>
      <div className="discussion-main">
        <h3>{discussion.title}</h3>
        <p className="discussion-preview">
          {truncate(discussion.body, 150)}
        </p>
        
        <div className="discussion-meta">
          <Avatar src={discussion.author.avatarUrl} size={20} />
          <span>{discussion.author.login}</span>
          <span>asked in {discussion.category.name}</span>
          <span>•</span>
          <span>{formatRelativeTime(discussion.createdAt)}</span>
        </div>
      </div>
      
      <div className="discussion-stats">
        <Stat icon="💬" value={discussion.comments.totalCount} />
        <Stat icon="👍" value={discussion.reactions.totalCount} />
      </div>
    </div>
  );
}
```

#### 7. Jobs View

**File: `CommunityPanel/views/JobsView.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export function JobsView({ community }) {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState({
    type: 'all', // 'full-time', 'contract', 'freelance'
    remote: false,
    experience: 'all' // 'junior', 'mid', 'senior'
  });
  
  useEffect(() => {
    loadJobs();
  }, [community, filter]);
  
  async function loadJobs() {
    // Fetch from community's jobs/listings.json
    const response = await fetch(
      `https://raw.githubusercontent.com/${getCommunityRepo()}/main/jobs/listings.json`
    );
    const data = await response.json();
    setJobs(filterJobs(data, filter));
  }
  
  return (
    <div className="jobs-view">
      <div className="jobs-header">
        <h2>Job Board</h2>
        <button onClick={() => postJob()} className="primary">
          💼 Post a Job
        </button>
      </div>
      
      <JobFilters filter={filter} onChange={setFilter} />
      
      <div className="jobs-list">
        {jobs.length === 0 ? (
          <EmptyState
            icon="💼"
            title="No jobs found"
            message="Check back later or adjust your filters"
          />
        ) : (
          jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onApply={() => applyToJob(job)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onApply }) {
  return (
    <div className="job-card">
      <div className="job-company">
        <img src={job.company.logo} alt={job.company.name} />
        <div>
          <h3>{job.title}</h3>
          <p>{job.company.name}</p>
        </div>
      </div>
      
      <p className="job-description">{job.description}</p>
      
      <div className="job-tags">
        <Tag>{job.type}</Tag>
        {job.remote && <Tag>🌍 Remote</Tag>}
        <Tag>{job.location}</Tag>
        <Tag>{job.experience}</Tag>
      </div>
      
      <div className="job-meta">
        <span>Posted {formatRelativeTime(job.postedAt)}</span>
        {job.salary && <span>💰 {job.salary}</span>}
      </div>
      
      <button onClick={onApply} className="primary">
        Apply Now
      </button>
    </div>
  );
}
```

### Implementation Tasks

- [ ] Create `CommunityPanel` main component
- [ ] Implement `HomeView` with featured content
- [ ] Implement `SessionsView` with browse/create/join
- [ ] Implement `ComponentsView` with search and filters
- [ ] Implement `LearnView` with tutorials
- [ ] Implement `DiscussView` with GitHub Discussions integration
- [ ] Implement `JobsView` with job listings
- [ ] Create all sub-components (cards, filters, dialogs)
- [ ] Add loading states and skeletons
- [ ] Add error handling and retry logic
- [ ] Implement infinite scroll for long lists
- [ ] Add keyboard navigation
- [ ] Style all components with Nodegx theme
- [ ] Add animations and transitions

### Verification Steps

- [ ] Community tab loads without errors
- [ ] Can switch between communities
- [ ] Featured content displays correctly
- [ ] Can browse and join sessions
- [ ] Can search and install components
- [ ] Tutorials load from GitHub
- [ ] Discussions integrate with GitHub
- [ ] Job board displays listings
- [ ] All filters work correctly
- [ ] UI is responsive and performant

---

## GIT-10: Session Discovery & Joining

**Priority**: High  
**Estimated Hours**: 50-70  
**Dependencies**: GIT-7, GIT-9

### Purpose

Streamline the session discovery and joining experience with deep linking, quick join flows, session previews, and favorites.

### Technical Requirements

#### 1. Deep Linking Support

**File: `packages/noodl-editor/src/editor/src/utils/DeepLinkHandler.ts`**

```typescript
import { app } from 'electron';

/**
 * Handle nodegx:// protocol URLs
 * Examples:
 * - nodegx://session/abc123
 * - nodegx://session/abc123?audio=true
 * - nodegx://community/add?repo=user/repo
 */

export class DeepLinkHandler {
  private handlers: Map<string, (params: any) => void> = new Map();
  
  constructor() {
    this.registerDefaultHandlers();
    this.setupProtocolHandler();
  }
  
  private registerDefaultHandlers() {
    // Session joining
    this.register('session', async (params) => {
      const { sessionId, audio, video } = params;
      
      await window.collaborationManager.joinSession({
        roomId: sessionId,
        audioEnabled: audio === 'true',
        videoEnabled: video === 'true'
      });
    });
    
    // Community adding
    this.register('community/add', async (params) => {
      const { repo } = params;
      const url = `https://github.com/${repo}`;
      
      await window.communityManager.addCommunity(url);
    });
    
    // Component installation
    this.register('component/install', async (params) => {
      const { repo, component } = params;
      
      await window.componentManager.install(repo, component);
    });
  }
  
  private setupProtocolHandler() {
    if (process.platform !== 'darwin') {
      app.setAsDefaultProtocolClient('nodegx');
    }
    
    // Handle URLs when app is already running
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.handleUrl(url);
    });
    
    // Handle URLs when app starts
    const url = process.argv.find(arg => arg.startsWith('nodegx://'));
    if (url) {
      this.handleUrl(url);
    }
  }
  
  handleUrl(url: string) {
    const parsed = new URL(url);
    const path = parsed.hostname + parsed.pathname;
    const params = Object.fromEntries(parsed.searchParams);
    
    const handler = this.handlers.get(path);
    if (handler) {
      handler(params);
    } else {
      console.warn(`No handler for deep link: ${path}`);
    }
  }
  
  register(path: string, handler: (params: any) => void) {
    this.handlers.set(path, handler);
  }
  
  generateLink(path: string, params?: Record<string, string>): string {
    const url = new URL(`nodegx://${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }
}
```

#### 2. Session Preview

**File: `packages/noodl-editor/src/editor/src/components/SessionPreview.tsx`**

```typescript
import React, { useEffect, useState } from 'react';

interface SessionPreviewProps {
  roomId: string;
  onJoin: () => void;
  onCancel: () => void;
}

export function SessionPreview({ roomId, onJoin, onCancel }: SessionPreviewProps) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadSessionInfo();
  }, [roomId]);
  
  async function loadSessionInfo() {
    try {
      // Fetch session metadata from signaling server or community repo
      const response = await fetch(
        `https://signal.nodegx.com/session/${roomId}/info`
      );
      const data = await response.json();
      setSession(data);
    } catch (err) {
      console.error('Failed to load session info:', err);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!session) {
    return (
      <ErrorState
        title="Session Not Found"
        message="This collaboration session may have ended or the link is invalid."
        onClose={onCancel}
      />
    );
  }
  
  return (
    <Dialog title="Join Collaboration Session" onClose={onCancel}>
      <div className="session-preview">
        <div className="session-host">
          <Avatar src={session.host.avatar} size={48} />
          <div>
            <h3>{session.host.name}</h3>
            <p>is hosting</p>
          </div>
        </div>
        
        <h2>{session.title}</h2>
        {session.description && <p>{session.description}</p>}
        
        <div className="session-details">
          <Detail
            icon="👥"
            label="Participants"
            value={`${session.participantCount}/${session.maxParticipants}`}
          />
          <Detail
            icon="📁"
            label="Project"
            value={session.projectName}
          />
          <Detail
            icon="🕐"
            label="Duration"
            value={formatDuration(session.duration)}
          />
        </div>
        
        <div className="session-features">
          {session.audioEnabled && <Feature icon="🎤" label="Audio Chat" />}
          {session.videoEnabled && <Feature icon="📹" label="Video" />}
          {session.screenShareEnabled && <Feature icon="🖥️" label="Screen Share" />}
        </div>
        
        <div className="participant-avatars">
          {session.participants.map(p => (
            <Avatar key={p.id} src={p.avatar} size={32} tooltip={p.name} />
          ))}
        </div>
        
        <div className="join-options">
          <Checkbox
            label="Join with audio enabled"
            checked={joinOptions.audio}
            onChange={(checked) => setJoinOptions({ ...joinOptions, audio: checked })}
          />
          {session.videoEnabled && (
            <Checkbox
              label="Join with video enabled"
              checked={joinOptions.video}
              onChange={(checked) => setJoinOptions({ ...joinOptions, video: checked })}
            />
          )}
        </div>
        
        <ButtonGroup>
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={onJoin} primary>
            Join Session
          </Button>
        </ButtonGroup>
      </div>
    </Dialog>
  );
}
```

#### 3. Quick Join Widget

**File: `packages/noodl-editor/src/editor/src/components/QuickJoinWidget.tsx`**

```typescript
import React, { useState } from 'react';

/**
 * Floating widget for quick session joining
 * Shows when user receives invite or pastes session link
 */
export function QuickJoinWidget({ invitation, onJoin, onDismiss }) {
  const [minimized, setMinimized] = useState(false);
  
  if (minimized) {
    return (
      <div className="quick-join-minimized" onClick={() => setMinimized(false)}>
        <span>👥 Session Invite</span>
        <Badge>{invitation.from}</Badge>
      </div>
    );
  }
  
  return (
    <div className="quick-join-widget">
      <div className="widget-header">
        <span>Collaboration Invite</span>
        <div className="widget-actions">
          <IconButton icon="−" onClick={() => setMinimized(true)} />
          <IconButton icon="×" onClick={onDismiss} />
        </div>
      </div>
      
      <div className="widget-content">
        <div className="invite-from">
          <Avatar src={invitation.fromAvatar} size={32} />
          <span>{invitation.from} invited you to collaborate</span>
        </div>
        
        <h3>{invitation.sessionTitle}</h3>
        {invitation.sessionDescription && (
          <p>{invitation.sessionDescription}</p>
        )}
        
        <div className="widget-meta">
          <span>👥 {invitation.participantCount} participants</span>
          {invitation.audioEnabled && <span>🎤 Audio</span>}
        </div>
      </div>
      
      <div className="widget-actions">
        <button onClick={onDismiss} className="secondary">
          Decline
        </button>
        <button onClick={onJoin} className="primary">
          Join Now
        </button>
      </div>
    </div>
  );
}
```

#### 4. Session History & Favorites

**File: `packages/noodl-editor/src/editor/src/services/SessionHistoryManager.ts`**

```typescript
interface SessionHistoryEntry {
  sessionId: string;
  roomId: string;
  title: string;
  host: {
    userId: string;
    name: string;
    avatar?: string;
  };
  joinedAt: Date;
  leftAt?: Date;
  duration: number;
  isFavorite: boolean;
}

export class SessionHistoryManager {
  private history: SessionHistoryEntry[] = [];
  private maxHistory = 50;
  
  constructor() {
    this.load();
  }
  
  addEntry(session: any) {
    const entry: SessionHistoryEntry = {
      sessionId: session.id,
      roomId: session.roomId,
      title: session.title,
      host: session.host,
      joinedAt: new Date(),
      duration: 0,
      isFavorite: false
    };
    
    this.history.unshift(entry);
    
    // Keep only most recent
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
    
    this.save();
  }
  
  updateEntry(sessionId: string, updates: Partial<SessionHistoryEntry>) {
    const entry = this.history.find(e => e.sessionId === sessionId);
    if (entry) {
      Object.assign(entry, updates);
      this.save();
    }
  }
  
  toggleFavorite(sessionId: string) {
    const entry = this.history.find(e => e.sessionId === sessionId);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
      this.save();
    }
  }
  
  getHistory(): SessionHistoryEntry[] {
    return this.history;
  }
  
  getFavorites(): SessionHistoryEntry[] {
    return this.history.filter(e => e.isFavorite);
  }
  
  private load() {
    const saved = localStorage.getItem('nodegx-session-history');
    if (saved) {
      this.history = JSON.parse(saved);
    }
  }
  
  private save() {
    localStorage.setItem('nodegx-session-history', JSON.stringify(this.history));
  }
}
```

### Implementation Tasks

- [ ] Implement deep link handler for `nodegx://` protocol
- [ ] Register protocol handler in Electron
- [ ] Create session preview dialog
- [ ] Implement quick join widget
- [ ] Create session history manager
- [ ] Add favorites functionality
- [ ] Implement session info API endpoint on signaling server
- [ ] Add "Copy Link" button to active sessions
- [ ] Add "Recent Sessions" panel
- [ ] Add "Favorite Sessions" panel
- [ ] Implement auto-rejoin for favorite sessions
- [ ] Add session notifications to system tray

### Verification Steps

- [ ] `nodegx://` links open the app
- [ ] Session preview loads correctly
- [ ] Can join session from deep link
- [ ] Quick join widget appears for invites
- [ ] Session history saves correctly
- [ ] Can favorite sessions
- [ ] Can rejoin from history
- [ ] Copy link generates correct URL

---

## GIT-11: Integration & Polish

**Priority**: High  
**Estimated Hours**: 61-82  
**Dependencies**: All previous tasks

### Purpose

Final integration, testing, documentation, and marketing preparation for the live collaboration and multi-community system.

### Implementation Tasks

#### 1. End-to-End Testing (20-25 hours)

- [ ] Create comprehensive test plan
- [ ] Test session creation and joining
- [ ] Test WebRTC connection establishment
- [ ] Test WebSocket fallback scenarios
- [ ] Test audio/video functionality
- [ ] Test cursor and selection sync
- [ ] Test node editing collaboration
- [ ] Test disconnection and reconnection
- [ ] Test notification delivery
- [ ] Test community switching
- [ ] Test deep link handling
- [ ] Test GitHub integration
- [ ] Test with multiple simultaneous users
- [ ] Test with poor network conditions
- [ ] Test with firewall restrictions

#### 2. Performance Optimization (15-20 hours)

- [ ] Profile WebRTC data channel usage
- [ ] Optimize Yjs document size
- [ ] Implement cursor position throttling
- [ ] Add viewport culling for remote cursors
- [ ] Optimize GitHub API calls (caching)
- [ ] Lazy load community content
- [ ] Implement virtual scrolling for lists
- [ ] Reduce bundle size (code splitting)
- [ ] Optimize WebSocket message frequency
- [ ] Add connection quality indicators

#### 3. Documentation (12-15 hours)

- [ ] Write user guide for collaboration
- [ ] Create community setup guide
- [ ] Document self-hosting instructions
- [ ] Create API documentation for servers
- [ ] Write troubleshooting guide
- [ ] Create video tutorials
- [ ] Document network requirements
- [ ] Create FAQ section
- [ ] Write privacy policy updates
- [ ] Document data retention policies

#### 4. Marketing Materials (8-12 hours)

- [ ] Create demo video (3-5 minutes)
- [ ] Create feature comparison matrix
- [ ] Design social media graphics
- [ ] Write blog post announcement
- [ ] Create press kit
- [ ] Design landing page
- [ ] Create case studies
- [ ] Prepare launch email

#### 5. Server Deployment (6-10 hours)

- [ ] Deploy signaling server to production
- [ ] Deploy sync server to production
- [ ] Deploy notification server to production
- [ ] Configure TURN server (Coturn)
- [ ] Set up monitoring (Grafana/Prometheus)
- [ ] Configure SSL certificates
- [ ] Set up backup systems
- [ ] Create deployment runbooks
- [ ] Set up alerting
- [ ] Load testing

### Verification Steps

- [ ] All automated tests pass
- [ ] Manual test scenarios complete
- [ ] Performance benchmarks met
- [ ] Documentation is complete and accurate
- [ ] Marketing materials are approved
- [ ] Servers are deployed and healthy
- [ ] Monitoring is active
- [ ] Backup systems tested
- [ ] Security audit passed
- [ ] Privacy compliance verified

### Launch Checklist

- [ ] Feature flag enabled for beta users
- [ ] Announcement blog post scheduled
- [ ] Social media posts scheduled
- [ ] Email to community drafted
- [ ] Support team trained
- [ ] Known issues documented
- [ ] Rollback plan prepared
- [ ] Success metrics defined
- [ ] Analytics tracking enabled
- [ ] Feedback collection system ready

---

## Additional Features & Ideas

### Future Enhancements (Not in Current Scope)

1. **Screen Sharing**
   - Share entire screen or specific window
   - Presenter mode with annotations
   - Remote control (with permission)

2. **Session Recording**
   - Record collaboration sessions
   - Replay with timeline scrubbing
   - Export as video

3. **Voice Commands**
   - "Claude, create a button node"
   - "Show me the login flow"
   - Hands-free collaboration

4. **AI Pair Programming**
   - Claude Code integration in sessions
   - Shared AI context
   - Real-time code suggestions visible to all

5. **Advanced Permissions**
   - Read-only participants
   - Moderator controls
   - Private work areas in shared session

6. **Session Scheduling**
   - Calendar integration
   - Recurring sessions
   - Automated invites

7. **Breakout Rooms**
   - Split large sessions into groups
   - Rotate between rooms
   - Rejoin main session

8. **Whiteboard Mode**
   - Shared drawing canvas
   - Sticky notes
   - Mind mapping

9. **Component Marketplace**
   - Paid component listings
   - Revenue sharing
   - Quality ratings

10. **Community Analytics**
    - Session participation stats
    - Component usage metrics
    - Engagement leaderboards

---

## Success Metrics

### Key Performance Indicators

**Adoption Metrics:**
- Number of communities created
- Number of collaboration sessions started
- Average session duration
- Number of components shared
- GitHub discussions activity

**Technical Metrics:**
- WebRTC connection success rate (target: >95%)
- Average time to establish connection (target: <3s)
- WebSocket fallback rate (target: <10%)
- Notification delivery rate (target: >99%)
- Server uptime (target: 99.9%)

**User Satisfaction:**
- Session completion rate (target: >80%)
- Feature usage (audio, video, cursor sharing)
- User retention (weekly active users)
- Net Promoter Score (target: >50)

---

## Risk Mitigation

### Technical Risks

**WebRTC Connection Failures:**
- Mitigation: Automatic WebSocket fallback
- Mitigation: TURN server for relay
- Mitigation: Clear error messages and troubleshooting

**Server Scaling:**
- Mitigation: Horizontal scaling architecture
- Mitigation: Load balancing
- Mitigation: Rate limiting

**Data Privacy:**
- Mitigation: End-to-end encryption for sensitive data
- Mitigation: Clear privacy policies
- Mitigation: User data controls

**Network Performance:**
- Mitigation: Adaptive quality (audio/video)
- Mitigation: Bandwidth estimation
- Mitigation: Connection quality indicators

### Business Risks

**Community Fragmentation:**
- Mitigation: Make official community compelling
- Mitigation: Cross-community component discovery
- Mitigation: Federated features (future)

**Moderation Challenges:**
- Mitigation: Leverage GitHub's moderation tools
- Mitigation: Community moderator system
- Mitigation: Reporting mechanisms

**Server Costs:**
- Mitigation: Encourage self-hosting
- Mitigation: P2P-first architecture
- Mitigation: Tiered pricing for heavy users

---

## Conclusion

This comprehensive task documentation covers the complete implementation of the Live Collaboration & Multi-Community System for Nodegx. The system transforms Nodegx into a collaborative platform while maintaining the BYOB philosophy through forkable communities and self-hosted infrastructure.

**Key Highlights:**
- 431-572 hours total development time
- 7 major task groupings (GIT-5 through GIT-11)
- Industry-first live collaboration for visual programming
- Multi-community architecture
- Persistent notification system
- Complete self-hosting capability

This positions Nodegx as the most advanced open-source visual development platform with collaboration features that rival or exceed commercial tools like Figma, while maintaining user ownership and freedom.
