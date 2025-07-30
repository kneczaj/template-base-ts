import type { TypePolicies } from '@apollo/client';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { findMissingIds, parseSchema } from './schemaIds.ts';

describe('Schema IDs tools', () => {
  describe('parseSchema', () => {
    it('should extract field type mappings from schema', () => {
      const testSchema = `
        type User {
          id: ID!
          email: String!
          posts: [Post!]!
        }
        type Post {
          id: ID!
          author: User!
          comments: [Comment!]!
        }
        type Comment {
          id: ID!
          author: User!
        }
      `;

      const result = parseSchema(testSchema);
      expect(result).toEqual({
        posts: 'Post',
        author: 'User',
        comments: 'Comment',
      });
    });

    it('should handle custom scalars correctly', () => {
      const testSchema = `
        scalar DateTime
        scalar JSON
        scalar Upload
        
        type User {
          id: ID!
          createdAt: DateTime!
          metadata: JSON
          avatar: Upload
          posts: [Post!]!
        }
        type Post {
          id: ID!
          publishedAt: DateTime!
          author: User!
        }
      `;

      const result = parseSchema(testSchema);
      expect(result).toEqual({
        posts: 'Post',
        author: 'User',
      });

      // Should not include custom scalars DateTime, JSON, Upload
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('metadata');
      expect(result).not.toHaveProperty('avatar');
      expect(result).not.toHaveProperty('publishedAt');
    });
  });

  describe('findMissingIds', () => {
    const testSchema = `
      type User { id: ID!, posts: [Post!]! }
      type Post { id: ID!, author: User! }
    `;
    const fieldTypeMapping = parseSchema(testSchema);

    it('should pass when all objects have id fields', () => {
      const query = `
        query {
          user {
            id
            posts {
              id
              author {
                id
              }
            }
          }
        }
      `;

      const ast = parse(query);
      const result = findMissingIds(ast, fieldTypeMapping, {});
      expect(result).toEqual([]);
    });

    it('should detect missing id fields', () => {
      const query = `
        query {
          user {
            id
            posts {
              title
              author {
                name
              }
            }
          }
        }
      `;

      const ast = parse(query);
      const result = findMissingIds(ast, fieldTypeMapping, {});
      expect(result).toEqual(['user.posts', 'user.posts.author']);
    });

    it('should pass when alternative key fields are present', () => {
      const query = `
        query {
          user {
            id
            posts {
              title
              author {
                email
              }
            }
          }
        }
      `;

      const ast = parse(query);
      const testTypePolicies: TypePolicies = {
        Post: { keyFields: ['title'] },
        User: { keyFields: ['email'] },
      };
      const result = findMissingIds(ast, fieldTypeMapping, testTypePolicies);
      expect(result).toEqual([]);
    });
  });
});
