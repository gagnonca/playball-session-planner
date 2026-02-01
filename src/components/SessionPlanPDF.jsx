import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    borderBottomStyle: 'solid',
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 12,
  },
  summaryItem: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    color: '#1e293b',
  },
  section: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderBottomStyle: 'solid',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sectionType: {
    fontSize: 8,
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '3 6',
    borderRadius: 3,
  },
  contentGrid: {
    marginTop: 6,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  contentItem: {
    flex: 1,
  },
  contentLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  contentText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.4,
  },
  imageContainer: {
    marginTop: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  image: {
    maxWidth: '100%',
    maxHeight: 150,
    objectFit: 'contain',
  },
  variation: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  variationTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  variationText: {
    fontSize: 8,
    color: '#334155',
    lineHeight: 1.3,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
});

export default function SessionPlanPDF({ session }) {
  console.log('SessionPlanPDF rendering with session:', session);

  const { summary = {}, sections = [] } = session || {};

  console.log('Summary:', summary);
  console.log('Sections:', sections);

  // Get the selected section (or all sections if none selected)
  const selectedSection = sections.find(s => s.id === session?.selectedSectionId);
  const sectionsToShow = selectedSection ? [selectedSection] : sections;

  console.log('Sections to show:', sectionsToShow);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{summary.title || 'Soccer Training Session'}</Text>
          {summary.moment && (
            <Text style={styles.subtitle}>Moment: {summary.moment}</Text>
          )}
        </View>

        {/* Summary Info */}
        <View style={styles.summaryRow}>
          {summary.date && (
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{summary.date}</Text>
            </View>
          )}
          {summary.duration && (
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{summary.duration}</Text>
            </View>
          )}
          {summary.ageGroup && (
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Age Group</Text>
              <Text style={styles.value}>{summary.ageGroup}</Text>
            </View>
          )}
        </View>

        {/* Player Actions and Key Qualities in one row */}
        {(summary.playerActions || summary.keyQualities) && (
          <View style={styles.summaryRow}>
            {summary.playerActions && (
              <View style={styles.summaryItem}>
                <Text style={styles.label}>Player Actions</Text>
                <Text style={styles.value}>
                  {Array.isArray(summary.playerActions)
                    ? summary.playerActions.join(', ')
                    : summary.playerActions}
                </Text>
              </View>
            )}
            {summary.keyQualities && (
              <View style={styles.summaryItem}>
                <Text style={styles.label}>Key Qualities</Text>
                <Text style={styles.value}>
                  {Array.isArray(summary.keyQualities)
                    ? summary.keyQualities.join(', ')
                    : summary.keyQualities}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Keywords */}
        {summary.keywords && (
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.label}>Keywords</Text>
            <Text style={styles.value}>{summary.keywords}</Text>
          </View>
        )}

        {/* Session Notes */}
        {summary.notes && (
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.label}>Session Notes</Text>
            <Text style={styles.value}>{summary.notes}</Text>
          </View>
        )}

        {/* Sections */}
        {sectionsToShow.map((section, index) => (
          <View key={section.id} style={styles.section} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {section.name || `Section ${index + 1}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {section.time && <Text style={styles.value}>{section.time}</Text>}
                <Text style={styles.sectionType}>{section.type}</Text>
              </View>
            </View>

            {/* Diagram Image */}
            {section.imageDataUrl && section.imageDataUrl.trim() && (
              <View style={styles.imageContainer}>
                <Image
                  src={section.imageDataUrl}
                  style={styles.image}
                  onError={(error) => console.error('PDF Image error:', error)}
                />
              </View>
            )}

            {/* Content Grid */}
            <View style={styles.contentGrid}>
              {/* First Row: Objective and Organization */}
              <View style={styles.contentRow}>
                {section.objective && (
                  <View style={styles.contentItem}>
                    <Text style={styles.contentLabel}>Objective</Text>
                    <Text style={styles.contentText}>{section.objective}</Text>
                  </View>
                )}
                {section.organization && (
                  <View style={styles.contentItem}>
                    <Text style={styles.contentLabel}>Organization</Text>
                    <Text style={styles.contentText}>{section.organization}</Text>
                  </View>
                )}
              </View>

              {/* Second Row: Keywords */}
              {section.keywords && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.contentLabel}>Key Words</Text>
                  <Text style={styles.contentText}>{section.keywords}</Text>
                </View>
              )}

              {/* Third Row: Questions and Answers */}
              <View style={styles.contentRow}>
                {section.questions && (
                  <View style={styles.contentItem}>
                    <Text style={styles.contentLabel}>Guided Questions</Text>
                    <Text style={styles.contentText}>{section.questions}</Text>
                  </View>
                )}
                {section.answers && (
                  <View style={styles.contentItem}>
                    <Text style={styles.contentLabel}>Answers</Text>
                    <Text style={styles.contentText}>{section.answers}</Text>
                  </View>
                )}
              </View>

              {/* Fourth Row: Notes */}
              {section.notes && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.contentLabel}>Notes</Text>
                  <Text style={styles.contentText}>{section.notes}</Text>
                </View>
              )}
            </View>

            {/* Variations */}
            {Array.isArray(section.variations) && section.variations.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.contentLabel}>Variations</Text>
                {section.variations.map((variation, vIndex) => (
                  <View key={variation?.id || vIndex} style={styles.variation}>
                    <Text style={styles.variationTitle}>{variation?.name || 'Variation'}</Text>
                    {variation?.description && (
                      <Text style={styles.variationText}>{variation.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Created with PlayBall Session Planner</Text>
        </View>
      </Page>
    </Document>
  );
}
