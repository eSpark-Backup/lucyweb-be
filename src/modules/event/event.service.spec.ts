import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';

describe('EventService', () => {
  let service: EventService;
  let prisma: Partial<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: PrismaService,
          useValue: {
            event: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createDefaultEventsForSchool', () => {
    it('returns 0 when events file is missing', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const count = await service.createDefaultEventsForSchool(123, 5);
      expect(count).toBe(0);
    });

    it('inserts events that do not exist', async () => {
      const fakeJson = JSON.stringify([
        { name: 'Foo', start_date: '2026-01-01', end_date: '2026-01-01' },
        { name: 'Bar', start_date: '2026-02-02', end_date: '2026-02-02' },
      ]);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(fakeJson);

      const findFirst = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockResolvedValue({});
      (prisma.event as any).findFirst = findFirst;
      (prisma.event as any).create = create;

      const inserted = await service.createDefaultEventsForSchool(10, 20);
      expect(inserted).toBe(2);
      expect(findFirst).toHaveBeenCalledTimes(2);
      expect(create).toHaveBeenCalledTimes(2);
      // ensure user/connect and school/connect data
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            school: { connect: { id: 10 } },
            user: { connect: { id: 20 } },
          }),
        }),
      );
    });

    it('skips existing events', async () => {
      const fakeJson = JSON.stringify([
        { name: 'Foo', start_date: '2026-01-01', end_date: '2026-01-01' },
      ]);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(fakeJson);

      const findFirst = jest.fn().mockResolvedValue({ id: 1 });
      const create = jest.fn();
      (prisma.event as any).findFirst = findFirst;
      (prisma.event as any).create = create;

      const inserted = await service.createDefaultEventsForSchool(10, 20);
      expect(inserted).toBe(0);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('getAllEventsByUserId', () => {
    it('filters out public events from the user_events list', async () => {
      // set up user lookup
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({ id: 7, school: null }),
      };

      // pretend the public query returned two events
      const pub1 = {
        id: 1,
        name: 'Default',
        start_date: new Date(),
        end_date: new Date(),
      };
      const pub2 = {
        id: 2,
        name: 'Global',
        start_date: new Date(),
        end_date: new Date(),
      };
      (prisma as any).event = {
        findMany: jest
          .fn()
          // first call returns public events
          .mockResolvedValueOnce([pub1, pub2])
          // second call returns user events including duplicates
          .mockResolvedValueOnce([
            { id: 1, name: 'Default' },
            { id: 3, name: 'My Event' },
          ]),
      };

      const result = await service.getAllEventsByUserId(7);
      expect(result.public_events).toEqual([pub1, pub2]);
      expect(result.user_events).toEqual([{ id: 3, name: 'My Event' }]);
    });

    it('only returns public events for the user’s school', async () => {
      // user belongs to school 5 and has no organisation
      (prisma as any).user = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 8, school: { id: 5 }, profile: null }),
      };
      // school lookup should still be performed but return only its own id
      (prisma as any).school = {
        findMany: jest.fn().mockResolvedValue([{ id: 5 }]),
      };

      const schoolEvent = { id: 10, school_id: 5, is_public: true };
      const otherSchoolEvent = { id: 11, school_id: 6, is_public: true };

      (prisma as any).event = {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([schoolEvent, otherSchoolEvent])
          .mockResolvedValueOnce([]),
      };

      const result = await service.getAllEventsByUserId(8);
      expect(result.public_events).toEqual([schoolEvent]);
      expect(result.user_events).toEqual([]);
      expect((prisma as any).school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: undefined } }),
      );
    });

    it('returns events for every school when user is organisation admin', async () => {
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          school: null,
          profile: { organization_id: 20 },
        }),
      };

      // org lookup should return two school ids
      (prisma as any).school = {
        findMany: jest.fn().mockResolvedValue([{ id: 5 }, { id: 6 }]),
      };

      const evs = [
        { id: 100, school_id: 5, is_public: true },
        { id: 101, school_id: 6, is_public: true },
      ];
      (prisma as any).event = {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(evs) // public query
          .mockResolvedValueOnce([]),
      };

      const result = await service.getAllEventsByUserId(9);
      expect(result.public_events).toEqual(evs);
      // ensure we fetched allowedSchoolIds from the database
      expect((prisma as any).school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: 20 } }),
      );

      // verify public query built using in-clause with those ids
      expect((prisma as any).event.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ school_id: { in: [5, 6] } }),
          ]),
        }),
      );
      // verify user query also used the in-clause
      expect((prisma as any).event.findMany.mock.calls[1][0].where).toEqual(
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ school_id: { in: [5, 6] } }),
          ]),
        }),
      );
    });

    it('hybrid user sees both their school and org schools', async () => {
      // user is both school user (id 5) and org user (org 20)
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 15,
          school: { id: 5 },
          profile: { organization_id: 20 },
        }),
      };
      (prisma as any).school = {
        findMany: jest.fn().mockResolvedValue([{ id: 5 }, { id: 6 }]),
      };

      const evs = [{ id: 200, school_id: 6, is_public: true }];
      (prisma as any).event = {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(evs) // public query
          .mockResolvedValueOnce([]),
      };

      const result = await service.getAllEventsByUserId(15);
      expect(result.public_events).toEqual(evs);
      // public query should use an in clause over the allowed ids
      expect((prisma as any).event.findMany.mock.calls[0][0].where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ school_id: { in: [5, 6] } }),
        ]),
      );
    });
  });

  describe('ownership checks', () => {
    it('throws when updating an event owned by another school', async () => {
      // existing event belongs to school 100 and user 50
      (prisma as any).event = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, school_id: 100, user_id: 50 }),
      };
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({ id: 20, school: { id: 5 } }),
      };

      await expect(service.updateEvent(1, { name: 'x' }, 20)).rejects.toThrow(
        'Not allowed to update this event',
      );
    });

    it('throws when deleting an event owned by another school', async () => {
      (prisma as any).event = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 2, school_id: 200, user_id: 60 }),
      };
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({ id: 30, school: { id: 5 } }),
      };

      await expect(service.deleteEvent(2, 30)).rejects.toThrow(
        'Not allowed to delete this event',
      );
    });

    it('prevents fetching another school’s public event by id', async () => {
      // user has school 99, event belongs to school 98 but is_public true
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({ id: 40, school: { id: 99 } }),
      };
      (prisma as any).event = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      const result = await service.getEventById(5, 40);
      expect(result).toBeNull();
      expect((prisma as any).event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ is_public: true, school_id: null }),
            ]),
          }),
        }),
      );
    });

    it('allows organisation user to fetch any school event by id', async () => {
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 50,
          school: null,
          profile: { organization_id: 30 },
        }),
      };
      // organization has two schools
      (prisma as any).school = {
        findMany: jest.fn().mockResolvedValue([{ id: 7 }, { id: 8 }]),
      };
      (prisma as any).event = {
        findFirst: jest.fn().mockResolvedValue({ id: 200 }),
      };

      const result = await service.getEventById(200, 50);
      expect(result).toEqual({ id: 200 });
      // ensure we fetched allowedSchoolIds
      expect((prisma as any).school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: 30 } }),
      );
      expect((prisma as any).event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ school_id: { in: [7, 8] } }),
            ]),
          }),
        }),
      );
    });

    it('hybrid organisation+school user can fetch outside-school event', async () => {
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 60,
          school: { id: 5 },
          profile: { organization_id: 40 },
        }),
      };
      (prisma as any).school = {
        findMany: jest.fn().mockResolvedValue([{ id: 5 }, { id: 9 }]),
      };
      (prisma as any).event = {
        findFirst: jest.fn().mockResolvedValue({ id: 300 }),
      };

      const result = await service.getEventById(300, 60);
      expect(result).toEqual({ id: 300 });
      expect((prisma as any).event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ school_id: { in: [5, 9] } }),
            ]),
          }),
        }),
      );
    });

    it('organisational user with no schools only sees global events', async () => {
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 70,
          school: null,
          profile: { organization_id: 99 },
        }),
      };
      // no schools returned for that org
      (prisma as any).school = { findMany: jest.fn().mockResolvedValue([]) };
      (prisma as any).event = {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 500, school_id: null, is_public: true },
          ])
          .mockResolvedValueOnce([]),
      };

      const result = await service.getAllEventsByUserId(70);
      expect(result.public_events).toEqual([
        { id: 500, school_id: null, is_public: true },
      ]);
      expect(result.user_events).toEqual([]);
      expect((prisma as any).school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: 99 } }),
      );
    });

    it('handles missing user gracefully by only returning globals', async () => {
      (prisma as any).user = { findUnique: jest.fn().mockResolvedValue(null) };
      (prisma as any).school = { findMany: jest.fn().mockResolvedValue([]) };
      const global = { id: 600, school_id: null, is_public: true };
      (prisma as any).event = {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([global])
          .mockResolvedValueOnce([]),
      };

      const result = await service.getAllEventsByUserId(999);
      expect(result.public_events).toEqual([global]);
      expect(result.user_events).toEqual([]);
    });

    it('allows org user to manage events across its trust schools', async () => {
      // event belongs to school 200 which is part of org 10
      (prisma as any).event = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 3, school_id: 200, user_id: 500 }),
      };
      // when checking school org, return matching org id
      (prisma as any).school = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 200, organization_id: 10 }),
      };
      // org user has profile with organization_id 10
      (prisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 60,
          school: null,
          profile: { organization_id: 10 },
        }),
      };

      // update should not throw
      await expect(
        service.updateEvent(3, { name: 'x' }, 60),
      ).resolves.toBeDefined();
      // delete should not throw
      await expect(service.deleteEvent(3, 60)).resolves.toBeDefined();
    });
  });
});
