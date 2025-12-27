// src/features/branding/BrandingMarketingHub.jsx
import { useState, useEffect } from "react";
import { loadData } from "../../utils/storage";
import { PRIMARY_BRAND } from "../../config/lookups";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function useLocalArray(key) {
  const [rows, setRows] = useState(() => loadData(key, []) || []);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save", key, e);
    }
  }, [key, rows]);

  return [rows, setRows];
}

function BrandingMarketingHub() {
  // Brand profile (single object)
  const [brandProfile, setBrandProfile] = useState(() => {
    const storedProfile = loadData("pc_brand_profile", {});
    return {
      brandName: storedProfile.brandName || PRIMARY_BRAND,
      mission: "", // Added mission field
      values: "",
      brandVoice: "",
      story: "",
      experienceNotes: "",
      packagingNotes: "", 
      spaceNotes: "", 
 ...storedProfile,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem("pc_brand_profile", JSON.stringify(brandProfile));
    } catch (e) {
      console.error("Failed to save pc_brand_profile", e);
    }
  }, [brandProfile]);

  const handleBrandProfileChange = (field, value) => {
    setBrandProfile((prev) => ({ ...prev, [field]: value }));
  };

  // Planning tables
  const [channels, setChannels] = useLocalArray("pc_brand_channels");
  const [campaigns, setCampaigns] = useLocalArray("pc_brand_campaigns");
  const [loyalty, setLoyalty] = useLocalArray("pc_brand_loyalty");

  const handleDeleteRow = (rows, setRows, rowId) => {
    setRows(rows.filter((row) => row.id !== rowId));
  };

  // ---- CHANNELS (digital + offline mix) ----
  const addChannelRow = () => {
    setChannels((prev) => [
      ...prev,
      {
        id: makeId(),
        channel: "",
        objective: "",
        frequency: "",
        budget: "",
        owner: "",
        status: "",
      },
    ]);
  };

  const handleChannelChange = (rowId, field, value) => {
    setChannels((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  // ---- CAMPAIGNS / CONTENT ----
  const addCampaignRow = () => {
    setCampaigns((prev) => [
      ...prev,
      {
        id: makeId(),
        name: "",
        brandOutlet: "",
        startDate: "",
        endDate: "",
        primaryChannel: "",
        keyMessage: "",
        status: "",
        notes: "",
      },
    ]);
  };

  const handleCampaignChange = (rowId, field, value) => {
    setCampaigns((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  // ---- LOYALTY / COMMUNITY / PARTNERSHIPS ----
  const addLoyaltyRow = () => {
    setLoyalty((prev) => [
      ...prev,
      {
        id: makeId(),
        initiative: "",
        type: "",
        partner: "",
        startDate: "",
        owner: "",
        status: "",
        notes: "",
      },
    ]);
  };

  const handleLoyaltyChange = (rowId, field, value) => {
    setLoyalty((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  return (
    <div>
      <h2 className="page-title">Branding & Marketing</h2>
      <p className="page-subtitle">
        Plan and track Marley's Burger&apos;s brand identity, digital and offline
        marketing, loyalty programs, and community engagement. This section
        focuses on brand consistency, customer experience, and growth tactics.
      </p>

      {/* BRAND IDENTITY / ESSENTIALS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Branding Essentials</h3>
        <p className="page-subtitle">
          Capture the core of your brand: who you are, what you stand for, and
          how you show up across all touchpoints (online and offline).
        </p>

        <div
          className="form-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <div className="form-field">
            <label>Brand / Group Name</label>
            <input
              type="text"
              value={brandProfile.brandName || ""}
              onChange={(e) =>
                handleBrandProfileChange("brandName", e.target.value)
              }
              placeholder="Marley's Burger, flagship campaigns, etc."
            />
          </div>

          <div className="form-field">
            <label>Brand voice & tone</label>
            <textarea
              rows={3}
              value={brandProfile.brandVoice || ""}
              onChange={(e) =>
                handleBrandProfileChange("brandVoice", e.target.value)
              }
              placeholder="e.g. bold, honest, playful, premium, community-driven..."
            />
          </div>

          <div className="form-field">
            <label>Mission</label>
            <textarea
              rows={3}
              value={brandProfile.mission || ""}
              onChange={(e) =>
                handleBrandProfileChange("mission", e.target.value)
              }
              placeholder="Why this brand exists and what success looks like."
            />
          </div>

          <div className="form-field">
            <label>Core values</label>
            <textarea
              rows={3}
              value={brandProfile.values || ""}
              onChange={(e) =>
                handleBrandProfileChange("values", e.target.value)
              }
              placeholder="Quality, transparency, value, community, etc."
            />
          </div>

          <div className="form-field">
            <label>Brand story</label>
            <textarea
              rows={4}
              value={brandProfile.story || ""}
              onChange={(e) =>
                handleBrandProfileChange("story", e.target.value)
              }
              placeholder="Short narrative that explains the concept and what makes it different."
            />
          </div>

          <div className="form-field">
            <label>Customer experience notes</label>
            <textarea
              rows={3}
              value={brandProfile.experienceNotes || ""}
              onChange={(e) =>
                handleBrandProfileChange("experienceNotes", e.target.value)
              }
              placeholder="How guests should feel at each touchpoint: website, delivery, dine-in."
            />
          </div>

          <div className="form-field">
            <label>Packaging & visual identity</label>
            <textarea
              rows={3}
              value={brandProfile.packagingNotes || ""}
              onChange={(e) =>
                handleBrandProfileChange("packagingNotes", e.target.value)
              }
              placeholder="Packaging ideas, materials, colors, logo usage, photography style."
            />
          </div>

          <div className="form-field">
            <label>Menu & space design notes</label>
            <textarea
              rows={3}
              value={brandProfile.spaceNotes || ""}
              onChange={(e) =>
                handleBrandProfileChange("spaceNotes", e.target.value)
              }
              placeholder="Menu layout, naming, décor, music, lighting aligned with the brand."
            />
          </div>
        </div>
      </div>

      {/* MARKETING CHANNELS */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Marketing Channels Plan</h3>
        <p className="page-subtitle">
          Define how each digital or offline channel will be used: objective,
          frequency, and budget. This can include social media, paid ads, email,
          Google, influencers, events, and local partnerships.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Objective</th>
                <th>Frequency / Cadence</th>
                <th>Budget (JOD / month)</th>
                <th>Owner</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr>
                  <td colSpan="7">No channels defined yet.</td>
                </tr>
              ) : (
                channels.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.channel || ""}
                        onChange={(e) =>
                          handleChannelChange(row.id, "channel", e.target.value)
                        }
                        placeholder="Instagram, Google Ads, TikTok, Email, Flyers..."
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.objective || ""}
                        onChange={(e) =>
                          handleChannelChange(
                            row.id,
                            "objective",
                            e.target.value
                          )
                        }
                        placeholder="Awareness, orders, upsell, traffic to delivery apps..."
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.frequency || ""}
                        onChange={(e) =>
                          handleChannelChange(
                            row.id,
                            "frequency",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 4 posts/week, always-on ads, monthly newsletter"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        value={row.budget || ""}
                        onChange={(e) =>
                          handleChannelChange(row.id, "budget", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.owner || ""}
                        onChange={(e) =>
                          handleChannelChange(row.id, "owner", e.target.value)
                        }
                        placeholder="Responsibile person/agency"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.status || ""}
                        onChange={(e) =>
                          handleChannelChange(row.id, "status", e.target.value)
                        }
                        placeholder="Planned, active, paused..."
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow(channels, setChannels, row.id)
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 8 }}
          onClick={addChannelRow}
        >
          + Add Channel
        </button>
      </div>

      {/* CAMPAIGNS & CONTENT */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Campaigns & Content</h3>
        <p className="page-subtitle">
          Plan specific campaigns, promos, or content pushes across outlets and
          brands (e.g. launch bursts, seasonal menus, combo deals, brand
          refresh).
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Campaign / Promo name</th>
                <th>Brand / Outlet</th>
                <th>Start</th>
                <th>End</th>
                <th>Primary channel</th>
                <th>Key message / CTA</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan="9">No campaigns planned yet.</td>
                </tr>
              ) : (
                campaigns.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.name || ""}
                        onChange={(e) =>
                          handleCampaignChange(row.id, "name", e.target.value)
                        }
                        placeholder="e.g. Burger Week, Seafood Festival, Ramadan Box Launch"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.brandOutlet || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "brandOutlet",
                            e.target.value
                          )
                        }
                        placeholder="Brand(s) / Outlet(s) included"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.startDate || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "startDate",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.endDate || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "endDate",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.primaryChannel || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "primaryChannel",
                            e.target.value
                          )
                        }
                        placeholder="Instagram, Meta Ads, influencers, in-store..."
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.keyMessage || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "keyMessage",
                            e.target.value
                          )
                        }
                        placeholder="Main hook and call-to-action"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.status || ""}
                        onChange={(e) =>
                          handleCampaignChange(
                            row.id,
                            "status",
                            e.target.value
                          )
                        }
                        placeholder="Planned, in design, live, complete..."
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.notes || ""}
                        onChange={(e) =>
                          handleCampaignChange(row.id, "notes", e.target.value)
                        }
                        placeholder="Results, learnings, AI ideas, etc."
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow(campaigns, setCampaigns, row.id)
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 8 }}
          onClick={addCampaignRow}
        >
          + Add Campaign
        </button>
      </div>

      {/* LOYALTY / COMMUNITY / PARTNERSHIPS / AI PERSONALISATION */}
      <div className="card">
        <h3 className="card-title">Loyalty, Community & Partnerships</h3>
        <p className="page-subtitle">
          Track loyalty programs, community events, local collaborations, and
          AI-powered personalization initiatives that keep guests coming back.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Type</th>
                <th>Partner / Segment</th>
                <th>Start</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Notes (mechanics, AI usage, etc.)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loyalty.length === 0 ? (
                <tr>
                  <td colSpan="8">No initiatives added yet.</td>
                </tr>
              ) : (
                loyalty.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.initiative || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(
                            row.id,
                            "initiative",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Points app, punch card, supper-club invite list"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.type || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(row.id, "type", e.target.value)
                        }
                        placeholder="Loyalty, community event, partnership, AI, CRM..."
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.partner || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(row.id, "partner", e.target.value)
                        }
                        placeholder="Local partner, customer segment, or platform"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.startDate || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(
                            row.id,
                            "startDate",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.owner || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(row.id, "owner", e.target.value)
                        }
                        placeholder="Responsible person"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.status || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(row.id, "status", e.target.value)
                        }
                        placeholder="Idea, planned, active, paused"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.notes || ""}
                        onChange={(e) =>
                          handleLoyaltyChange(row.id, "notes", e.target.value)
                        }
                        placeholder="Mechanics, rewards, AI personalization, integration with POS, etc."
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteRow(loyalty, setLoyalty, row.id)
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="primary-btn"
          style={{ marginTop: 8 }}
          onClick={addLoyaltyRow}
        >
          + Add Initiative
        </button>
      </div>
    </div>
  );
}

export default BrandingMarketingHub;
