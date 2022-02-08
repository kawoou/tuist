import {
  ChangeRemoteCacheStorageDocument,
  ChangeRemoteCacheStorageMutation,
  CreateS3BucketDocument,
  CreateS3BucketMutation,
  S3BucketsDocument,
  S3BucketsQuery,
} from '../../../graphql/types';
import { ApolloClient } from '@apollo/client';
import { SelectOption } from '@shopify/polaris';
import { makeAutoObservable, runInAction } from 'mobx';
import ProjectStore from '../../../stores/ProjectStore';
import { mapS3Bucket, S3Bucket } from '@/models/S3Bucket';

class RemoteCachePageStore {
  bucketName = '';
  accessKeyId = '';
  secretAccessKey = '';
  s3Buckets: S3Bucket[] = [];

  client: ApolloClient<object>;
  projectStore: ProjectStore;

  constructor(
    client: ApolloClient<object>,
    projectStore: ProjectStore,
  ) {
    this.client = client;
    this.projectStore = projectStore;
    makeAutoObservable(this);
  }

  get isSecretAccessKeyTextFieldDisabled(): boolean {
    return (
      this.selectedOption !== 'new' &&
      this.secretAccessKey ===
        this.projectStore.project.remoteCacheStorage?.secretAccessKey
    );
  }

  get bucketOptions(): SelectOption[] {
    return [
      {
        label: 'Create new bucket',
        value: 'new',
      },
      ...this.s3Buckets.map((s3Bucket) => {
        return { label: s3Bucket.name, value: s3Bucket.name };
      }),
    ];
  }

  get selectedOption(): string {
    if (
      this.projectStore.project == null ||
      this.projectStore.project.remoteCacheStorage == null
    ) {
      return 'new';
    }
    return this.projectStore.project.remoteCacheStorage.name;
  }

  removeAccessKey() {
    this.secretAccessKey = '';
  }

  async changeRemoteCacheStorage() {
    if (this.projectStore.project.remoteCacheStorage == null) {
      return;
    }
    await this.client.mutate<ChangeRemoteCacheStorageMutation>({
      mutation: ChangeRemoteCacheStorageDocument,
      variables: {
        input: {
          id: this.projectStore.project.remoteCacheStorage.id,
          projectId: this.projectStore.project.id,
        },
      },
    });
  }

  handleSelectOption(option: string) {
    if (this.projectStore == null) {
      return;
    }
    if (option == 'new') {
      this.projectStore.project.remoteCacheStorage = null;
      this.bucketName = '';
      this.accessKeyId = '';
      this.secretAccessKey = '';
    }
    const s3Bucket = this.s3Buckets.find(
      (s3Bucket) => s3Bucket.name === option,
    );
    this.projectStore.project.remoteCacheStorage = s3Bucket ?? null;
    if (s3Bucket == null) {
      return;
    }
    this.bucketName = s3Bucket.name;
    this.accessKeyId = s3Bucket.accessKeyId;
    this.secretAccessKey = s3Bucket.secretAccessKey;
    this.changeRemoteCacheStorage();
  }

  get isApplyChangesButtonDisabled() {
    return (
      this.bucketName.length === 0 ||
      this.accessKeyId.length === 0 ||
      this.secretAccessKey.length === 0
    );
  }

  get isCreatingBucket() {
    return this.selectedOption === 'new';
  }

  async load() {
    if (this.projectStore.project == null) {
      return;
    }
    const { data } = await this.client.query<S3BucketsQuery>({
      query: S3BucketsDocument,
      variables: {
        accountName: this.projectStore.project.account.name,
      },
    });
    runInAction(() => {
      this.s3Buckets = data.s3Buckets.map((bucket) =>
        mapS3Bucket(bucket),
      );
      if (this.projectStore.project.remoteCacheStorage == null) {
        return;
      }
      this.bucketName =
        this.projectStore.project.remoteCacheStorage.name;
      this.accessKeyId =
        this.projectStore.project.remoteCacheStorage.accessKeyId;
      this.secretAccessKey =
        this.projectStore.project.remoteCacheStorage.secretAccessKey;
    });
  }

  async applyChangesButtonClicked(accountId: string) {
    if (this.isCreatingBucket) {
      const { data } =
        await this.client.mutate<CreateS3BucketMutation>({
          mutation: CreateS3BucketDocument,
          variables: {
            input: {
              name: this.bucketName,
              accessKeyId: this.accessKeyId,
              secretAccessKey: this.secretAccessKey,
              accountId,
            },
          },
        });
      if (this.projectStore.project == null || data == null) {
        return;
      }
      const s3Bucket = mapS3Bucket(data.createS3Bucket);
      runInAction(() => {
        this.projectStore.project.remoteCacheStorage = s3Bucket;
        this.s3Buckets.push(s3Bucket);
      });
    }
  }
}

export default RemoteCachePageStore;